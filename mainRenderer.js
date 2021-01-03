const ipc = require('electron').ipcRenderer

function updateProjectType() {
    const projectTypeSelect = document.getElementById('configurationSelect')
    ipc.invoke('update-configuration-select').then((result) => {
        for (var i = 0; i < result.length; i++) {
            var option = document.createElement('option')
            option.id = option.value = result[i]['id']
            option.text = result[i]['name']
            projectTypeSelect.add(option)
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

            ipc.send('archive-info', archiveFolderPath, projectFolderName)
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
    ipc.send('configuration-select', configurationSelect.value)
})
