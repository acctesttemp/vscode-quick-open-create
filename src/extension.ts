'use strict';
/**
 * NOTE: 
 * This is my first VSCode extension. Happy for any feedback
 * This is my first time using TypeScript. Again, happy for any feedback.
 */
import { commands, window, ExtensionContext, workspace, Uri, DocumentHighlight } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {denodeify} from 'q';
import { exec } from 'child_process';

interface QuickPickItem { // Add props to QPI without TS complaining.
    label: string,
    description?: string,
    path?: string,
    isFolder?: boolean
}

const readdir = denodeify(fs.readdir);
const fsStat = denodeify(fs.stat);
const ignoreExtensions: string[] = ['.png', '.jpg', '.gif']; // todo: use contributes configuration endpoint
const cmd = {
    newFile: '$(plus) New file',
    moveUp: '$(file-directory) ../',
    openExt: "$(file-directory) ..."
};

const onlyAllowed = f => ignoreExtensions.indexOf(`${path.extname(f.path)}`) === -1;

// Only run in WindowOS, => function style not working :(
function spawnExplorer ( spawnType:string , fileName:string) {
    if (process.platform === "win32") {
        // Windows
        const cfg = workspace.getConfiguration("TotalCommander");
        if (cfg.path) {
            // spawn(cfg.path, ["/OPEN", fileName]);
            exec("\"" + cfg.path + "\" /OPEN " + fileName);
        } else {
            if (spawnType === "folder") {
                // spawn('explorer.exe', [fileName]);
                exec('explorer.exe ' + fileName);
            } else if (spawnType === "file") {
                // spawn('explorer.exe', ["/select,\""+fileName+"\""]);
                exec('explorer.exe ' + "/select,\""+fileName+"\"");
            }
        }
    } else if (process.platform === "darwin"){
        // MacOS 
    } else {
        //Others OS
    }
}

const selectFile = async (startDir: string, origin?: string) => {
    if (!origin) { 
        // origin = path.basename(startDir) + path.sep;
        origin = startDir + path.sep;
    }

    const contents: string[] = await readdir(startDir);
    const items: QuickPickItem[] = await Promise.all(contents.map(async f => {
        // const filePath = path.join(startDir, f);
        // const stats = (await fsStat(filePath));
        // const isFolder = stats.isDirectory();
        // const label = isFolder ? `$(file-directory) ${f}/` : `$(file-code) ${f}`;

        // return {
        //     label,
        //     isFolder,
        //     path: filePath
        // };
        try {
            const filePath = path.join(startDir, f);
            const stats = (await fsStat(filePath));
            const isFolder = stats.isDirectory();
            const label = isFolder ? `$(file-directory) ${f}/` : `$(file-code) ${f}`;

            return {
                label,
                isFolder,
                path: filePath
            };
        } catch (err) {
            const filePath = path.join(startDir, f);
            const isFolder = false;
            const label = isFolder ? `$(file-directory) ${f}/` : `$(file-code) ${f}`;

            return {
                label,
                isFolder,
                path: filePath
            };
        }
    }))

    const cmds: any[] = [
        {
            label: cmd.newFile,
            description: `in ${path.normalize(origin)}`
        }, {
            label: cmd.moveUp,
            description: `move up a folder`
        }, {
            label: cmd.openExt,
            description: `open with external`
        }
    ];

    const selection: any = await window.showQuickPick([
        ...cmds, ...items.filter(onlyAllowed)
    ], {ignoreFocusOut:true});

    if (selection === undefined) {
        return;
    }

    if (selection.isFolder) {
        return selectFile(selection.path, origin + path.basename(selection.path) + path.sep); 
    }

    // Create new File
    if (selection.label === cmd.newFile) {
        const fileName = await window.showInputBox({
            prompt: 'Enter the name of the new file'
        });

        // Absolute path
        if (fileName !== undefined && fileName.match(/^([a-zA-Z]:[\\/]|\\\\\w|\/)/g)) {
            if (fs.existsSync(fileName)) {
                const stats = (await fsStat(fileName));
                const isFolder = stats.isDirectory();
                if (isFolder) {
                    return selectFile(path.resolve(fileName), fileName + path.sep);
                } else {
                    // return selectFile(path.resolve(path.dirname(fileName)), path.dirname(fileName) + path.sep);
                    return Uri.file(fileName)
                }
            } else {                
                return Uri.file(fileName).with({
                    scheme: 'untitled'
                });
            }
        }

        // Relative path to workspace: begin with ./ or .\
        if (fileName !== undefined && fileName.match(/^\.[\\/]/g)) {
            return fileName ? Uri.file(path.join(workspace.rootPath, fileName)).with({
                scheme: 'untitled'
            }) : undefined;
        }

        // Shortcut for open current folder of active open text file.
        if (fileName === "") {
            // Sometime runtime in welcome screen or emty editor, still pass and open as "" filename ['MyComputer'] showup.
            if (window.activeTextEditor) {
                let fName = "/select,\""+window.activeTextEditor.document.fileName+"\"";
                spawnExplorer("file", window.activeTextEditor.document.fileName);
            }
                
        }
        // Relative path to current open file, may overide by abs path above!
        return fileName ? Uri.file(path.join(startDir, fileName)).with({
            scheme: 'untitled'
        }) : undefined;
    } 

    // Move up one folder
    if (selection.label === cmd.moveUp) {
        return selectFile(path.resolve(startDir, '..'), origin + '..' + path.sep);
    }

    // Open external browser with input path
    if (selection.label === cmd.openExt) {
        const fileName = await window.showInputBox({
            prompt: 'Enter the name of the open file'
        });

        // Absolute path
        if (fileName !== undefined && fileName.match(/^([a-zA-Z]:[\\/]|\\\\\w|\/)/g)) {
            if (fs.existsSync(fileName)) {
                try {
                    const stats = (await fsStat(fileName));
                    const isFolder = stats.isDirectory();
                    if (isFolder) {
                        spawnExplorer( "folder", fileName);
                        return selectFile(path.resolve(fileName), fileName + path.sep);
                    } else {
                        spawnExplorer( "file", fileName);
                        return selectFile(path.resolve(path.dirname(fileName)), path.dirname(fileName) + path.sep);
                    }
                } catch (error) {
                    return selectFile(path.resolve(path.dirname(fileName)), path.dirname(fileName) + path.sep);
                }
            } else {
                // try folder up if exist
                let dirExistLevel = path.dirname(fileName)
                while (true) {
                    if (fs.existsSync(dirExistLevel)) {
                        spawnExplorer("folder", dirExistLevel);
                        break;
                    }
                    const upDirExistLevel = path.dirname(dirExistLevel);
                    if ( upDirExistLevel === dirExistLevel) { break;}
                    dirExistLevel = upDirExistLevel;
                };
                return Uri.file(fileName).with({
                    scheme: 'untitled'
                });
            }
        }
        
        // Relative path to workspace: begin with ./ or .\
        if (fileName !== undefined && fileName.match(/^\.[\\/]/g)) {
            spawnExplorer("folder", path.join(workspace.rootPath, fileName));
            return fileName ? Uri.file(path.join(workspace.rootPath, fileName)).with({
                scheme: 'untitled'
            }) : undefined;
        }

        // Relative path to current open file, may overide by abs path above!
        spawnExplorer("folder", path.join(startDir, fileName));
        return fileName ? Uri.file(path.join(startDir, fileName)).with({
            scheme: 'untitled'
        }) : undefined;
    }

    return selection.path;
}

export function activate(context: ExtensionContext) {
    let disposable = commands.registerCommand('quickOpenCreate.open', async () => {
        // if (!window.activeTextEditor) {
        //     return;  // no file open
        // }

        try {
            // const currentDir = path.dirname(window.activeTextEditor.document.fileName);
            let currentDir = workspace.rootPath;
            if (window.activeTextEditor){
                currentDir = path.dirname(window.activeTextEditor.document.fileName);
                if (currentDir === "."){
                    currentDir = workspace.rootPath;
                }
            };
            const openPath = await selectFile(currentDir);

            if (openPath === undefined) {
                return; // abort!
            }

            const doc = await workspace.openTextDocument(openPath);

            if (!doc) {
                throw new Error(`could not open file ${doc}`);
            }

            window.showTextDocument(doc);
        } catch (err) {
            if (err.message) {
                window.showErrorMessage(err.message);
            }
        }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}