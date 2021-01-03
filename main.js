const { app, BrowserWindow, dialog, Menu } = require('electron')
const ipc = require('electron').ipcMain
const fs = require('fs')
const findit = require('findit')
const zip = require('7zip-min')
const xml = require('xml2js')
const xmlbuilder = require('xmlbuilder2')

let configsList = []
let homeWindow = null
let configurationsWindow = null

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
                    rules: xmlConfigData.rule
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

    let archiveFilename = null
    let archiveFilepath = null
    ipc.on('archive-info', (event, archiveFolderPath, projectFolderName) => {
        archiveFilename = projectFolderName
        archiveFilepath = archiveFolderPath + '\\' + archiveFilename
    })

    ipc.handle('update-configuration-select', async (event) => {
        return configsList
    })

    let configurationId = null
    ipc.on('configuration-select', (event, value) => {
        configurationId = value
        console.log(configurationId)
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
