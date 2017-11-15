# quick-open-create README

> This extension is currently work in progress. Consider this an alpha release.

quick-open-create makes it easy to open and create new files relative to the
currently open one and browsing the directories without leaving the keyboard.

![overview](https://github.com/nocksock/vscode-quick-open-create/raw/master/video/overview.mp4.gif)

## Pro Tip!

Add this to your keybindings.json, to open siblings etc easily with `cmd+o` or whatever floats your boat.

    {
      "command": "quickOpenCreate.open",
      "key": "cmd+o"
    }

## Features

quick-open-create will give you an easy way to show and and select the siblings
of the current file to open it, or create a new one. This is really helpful when
dealing with component based projects where you have related files next to each
other. eg: scss, html, js and some config file. 
