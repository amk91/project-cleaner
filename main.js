const { app, BrowserWindow, dialog, Menu } = require('electron')
const ipc = require('electron').ipcMain
const fs = require('fs')
const archiver = require('archiver')
const dir = require('node-dir')
const xml = require('xml2js')
const xmlbuilder = require('xmlbuilder2')
const globToRegExp = require('glob-to-regexp')

let configsList = []

let homeWindow = null
let configurationsWindow = null

class ProjectArchiver {
    constructor(homeWindow = null) {
        this.homeWindow = homeWindow

        this.init()
    }

    init(
        archiveFolderPath = "",
        projectFolderName = "",
        configurationId = -1,
        options = {
            archiveFormat: 'zip',
            archiveLevel: 9,
        }
    ) {
        this.stopArchiveProject = false

        this.configurationId = configurationId

        this.archive = archiver(
            options.archiveFormat,
            { zlib: { level: options.archiveLevel } }
        )

        this.archiveFolderPath = archiveFolderPath;
        this.projectFolderName = projectFolderName;

        this.archiveFilePath = ""
        if (this.archiveFolderPath.length > 0 && this.projectFolderName.length > 0) {
            this.archiveFilePath =
                archiveFolderPath + '\\' +
                projectFolderName + '.' +
                options.archiveFormat

            this.projectFolderPath =
                archiveFolderPath + '\\' +
                projectFolderName

            this.outputFile = fs.createWriteStream(this.archiveFilePath)
        }
    }

    async archiveProject() {
        if (configurationId < 0) {
            return
        }

        var config = null
        for (let i = 0; i < configsList.length; ++i) {
            if (configsList[i].id === configurationId) {
                config = configsList[i]
                break
            }
        }

        if (config === null) {
            return
        }

        const getAllDirFiles = function (dirPath, arrayOfFiles) {
            let files = fs.readdirSync(dirPath)
            arrayOfFiles = arrayOfFiles || []
            files.forEach((file) => {
                if (fs.statSync(dirPath + '/' + file).isDirectory()) {
                    arrayOfFiles = getAllDirFiles(dirPath + '/' + file, arrayOfFiles)
                } else {
                    arrayOfFiles.push(file)
                }
            })

            return arrayOfFiles
        }

        new Promise((resolve, reject) => {
            var files = getAllDirFiles(this.projectFolderPath, files)
            if (files && files.length > 0) {
                resolve(files)
            } else {
                reject()
            }
        }).then((files) => {
            if (this.homeWindow) {
                this.homeWindow.webContents.send('archive-project-number-of-files', files.length)
            }
        }).catch((reason) => {
            //TODO: handle rejected promise
        })

        this.archive.pipe(this.outputFile)

        this.archive.on('progress', (progress) => {
            if (this.homeWindow) {
                this.homeWindow.webContents.send('archive-project-progress', progress)
            }
        })

        this.archive.on('warning', (error) => {
            //TODO: handle warning
        })

        this.archive.on('error', (data) => {
            //TODO: handle error
        })

        new Promise((resolve, reject) => {
            dir.readFiles(
                this.projectFolderPath,
                (err, content, filename, next) => {
                    var name = filename.split(this.archiveFolderPath).pop()

                    var archiveFile = true
                    for (
                        let ruleIndex = 0;
                        ruleIndex < config.regexRules.length && archiveFile;
                        ruleIndex++
                    ) {
                        archiveFile = !config.regexRules[ruleIndex].test(name)
                    }

                    if (archiveFile) {
                        this.archive.file(filename, { name: name })
                    }

                    if (this.stopArchiveProject) {
                        reject('stop')
                    } else {
                        next()
                    }
                },
                (err, files) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve()
                    }
                }
            )
        }).then(() => {
            return this.archive.finalize()
        }).then(() => {
            if (homeWindow) {
                homeWindow.webContents.send('archive-project-finalize')
            }
        }).catch((reason) => {
            //TODO: handle rejected promise
        })
    }

    stopArchivingProcess() {
        if (!this.stopArchiveProject) {
            this.stopArchiveProject = true

            this.archive.pause()

            this.outputFile.end()
            this.outputFile.close()

            this.archive.unpipe()

            fs.unlinkSync(this.archiveFilePath)
        }
    }
}

async function onShowConfigurations() {
    configurationsWindow = new BrowserWindow({
        parent: homeWindow,
        modal: true,
        width: 300,
        height: 400,
        webPreferences: {
            nodeIntegration: true
        }
    })

    configurationsWindow.setMenuBarVisibility(false)
    configurationsWindow.once('ready-to-show', () => {
        configurationsWindow.show()
    })
}

function loadConfigurationFromFile() {
    //TODO: exit properly if file doesn't exist or is not in a good format
    if (fs.existsSync('config.xml')) {
        var xmlData = fs.readFileSync('config.xml')
        var xmlConfigs
        xml.parseString(xmlData, (err, result) => {
            if (err) {
                console.log(err.stack)
                return err
            }

            xmlConfigs = result
        })

        if (xmlConfigs.configs.config) {
            for (var i = 0; i < xmlConfigs.configs.config.length; i++) {
                const xmlConfigData = xmlConfigs.configs.config[i]
                var config = {
                    id: parseInt(xmlConfigData.id[0]),
                    name: xmlConfigData.name[0],
                    rules: xmlConfigData.rule,
                    regexRules:
                        xmlConfigData.rule ?
                        xmlConfigData.rule.map(x => globToRegExp(x)) : []
                }
                configsList.push(config)
            }
        }
    } else {
        console.log('WARNING: config.xml file does not exist')
        configsList.push({
            id: 0,
            name: 'Visual C++',
            rules: ['*.dll', '*.exe', '*.lib', '*.obj']
        })
    }
}

function saveConfigurationToFile() {
    //TODO: keep track of changes in the config file
    try {
        const root = xmlbuilder.create({ version: '1.0' }).ele('configs')
        for (var i = 0; i < configsList.length; i++) {
            const config = configsList[i]

            var xmlConfig = root.ele('config')
            var xmlId = xmlConfig.ele('id')
            xmlId.txt(config.id)

            var xmlName = xmlConfig.ele('name')
            xmlName.txt(config.name)

            if (config.rules) {
                for (var j = 0; j < config.rules.length; j++) {
                    var xmlRules = xmlConfig.ele('rule')
                    xmlRules.txt(config.rules[j])
                }
            }
        }

        const xml = root.end({ prettyPrint: true })
        fs.writeFile('config.xml', xml, 'utf8', (err) => {
            if (err) console.log(err.stack)
        })
    } catch (err) {
        console.log(err.stack)
    }
}

const emptyMenu = Menu.buildFromTemplate([])
Menu.setApplicationMenu(emptyMenu)

function runApp() {
    homeWindow = new BrowserWindow({
        width: 500,
        height: 500,
        webPreferences: {
            nodeIntegration: true
        }
    })

    loadConfigurationFromFile()

    const projectArchiver = new ProjectArchiver(homeWindow)

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Show configurations',
                    click: onShowConfigurations
                },
                {
                    label: 'Exit',
                    role: 'quit'
                }
            ]
        }
    ]
    const menu = Menu.buildFromTemplate(menuTemplate)

    homeWindow.setMenuBarVisibility(true)
    homeWindow.setMenu(menu)
    homeWindow.loadFile('main.html')

    ipc.handle('open-folder-dialog', async (event) => {
        var result = await dialog.showOpenDialog(
            homeWindow,
            {
                properties: ['openDirectory']
            }
        )

        return result.filePaths[0]
    })

    let projectFolderPath = null
    let projectFolderName = null
    let archiveFolderPath = null
    ipc.on('archive-info', (
        event,
        _projectFolderPath,
        _archiveFolderPath,
        _projectFolderName
        ) => {
            projectFolderPath = _projectFolderPath
            projectFolderName = _projectFolderName
            archiveFolderPath = _archiveFolderPath
        }
    )

    ipc.on('configuration-select', (event, value) => {
        projectArchiver.configurationId = configurationId = value
    })

    ipc.on('start-archive-project', (event) => {
        projectArchiver.init(archiveFolderPath, projectFolderName, configurationId)
        projectArchiver.archiveProject()
    })

    ipc.on('stop-archive-project', (event) => {
        projectArchiver.stopArchivingProcess()
    })

    ipc.handle('update-configuration-select', async (event) => {
        return configsList
    })

    homeWindow.once('ready-to-show', () => {
        homeWindow.show()
    })
}

app.whenReady().then(runApp)

app.on('window-all-closed', () => {
    app.quit()

    saveConfigurationToFile()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        runApp()
    }
})
