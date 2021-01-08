const ipc = require('electron').ipcRenderer

function updateProjectType() {
    const configurationSelect = document.getElementById('configurationSelect')
    ipc.invoke('update-configuration-select').then((result) => {
        if (result) {
            for (var i = 0; i < result.length; i++) {
                var option = document.createElement('option')
                option.id = option.value = result[i]['id']
                option.text = result[i]['name']
                configurationSelect.add(option)
            }

            if (result.length > 0) {
                configurationSelect.value = result[0]['id'].toString()
                ipc.send('configuration-select', parseInt(configurationSelect.value))
            }
        }
    })
}


window.addEventListener('load', () => {
    // Load all the necessary data for the page
    updateProjectType()
})

const projectFolderInput = document.getElementById('projectFolderInput')
const projectFolderOpenButton = document.getElementById('projectFolderOpenButton')

const archiveFolderInput = document.getElementById('archiveFolderInput')

var projectFolderPath = null
var archiveFolderPath = null

projectFolderOpenButton.addEventListener('click', () => {
    ipc.invoke('open-folder-dialog').then((result) => {
        projectFolderPath = result
        projectFolderInput.value = projectFolderPath

        if (projectFolderPath) {
            archiveFolderPath = projectFolderPath.substring(0, projectFolderPath.lastIndexOf('\\'))
            archiveFolderInput.value = archiveFolderPath

            const projectFolderName = projectFolderPath.substring(
                projectFolderPath.lastIndexOf('\\') + 1,
                projectFolderPath.length
            )

            ipc.send('archive-info', projectFolderPath, archiveFolderPath, projectFolderName)
        }
    })
})

const archiveFolderOpenButton = document.getElementById('archiveFolderOpenButton')
archiveFolderOpenButton.addEventListener('click', () => {
    ipc.invoke('open-folder-dialog').then((result) => {
        archiveFolderPath = result
        archiveFolderInput.value = archiveFolderPath
    })
})

const configurationSelect = document.getElementById('configurationSelect')
configurationSelect.addEventListener('change', (event) => {
    ipc.send('configuration-select', parseInt(configurationSelect.value))
})

// ipc.on('archive-project-finalize', () => {
//     alert('archive-project-finalize')
// })

ipc.on('archive-project-number-of-files', (event, numberOfFiles) => {
    document.getElementById('numberOfTotalFiles').textContent = numberOfFiles
    document.getElementById('processedFileProgress').setAttribute('max', numberOfFiles)
})

ipc.on('archive-project-progress', (event, progress) => {
    document.getElementById('numberOfProcessedFiles').textContent = progress.entries.processed
    document.getElementById('processedFileProgress').setAttribute('value', progress.entries.processed)
})

const startButton = document.getElementById('startButton')
startButton.addEventListener('click', (event) => {
    ipc.send('start-archive-project')
})

const stopButton = document.getElementById('stopButton')
stopButton.addEventListener('click', (event) => {
    ipc.send('stop-archive-project')
})