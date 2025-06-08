# Solidtime VS Code Extension

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/1M4nt0.solidtime-vscode-extension?style=for-the-badge&label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=1M4nt0.solidtime-vscode-extension)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)


Seamlessly track your coding time with automatic project detection. This extension is perfect for freelancers, remote teams, and productivity-focused developers who want to automate their time tracking without leaving their editor.

## Features

- **Automatic Time Tracking**: No need to start or stop timers manually. The extension tracks your coding activity automatically.
- **Project Detection**: Automatically detects the project you're working on based on your workspace name. If the project doesn't exist in Solidtime, it's created for you.
- **Focus Tracking**: The tracker intelligently pauses when you're not active in VS Code and resumes when you return.

## Installation

1. Open **Visual Studio Code**.
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3. Search for `Solidtime - Automatic Time Tracking`.
4. Click **Install**.

## Configuration

Before using the extension, you need to configure a few settings.

1.  **Get your credentials from Solidtime:**
    *   Log in to your [Solidtime account](https://app.solidtime.io/).
    *   Navigate to your account/profile settings to find your **API Key** and **Organization ID**.

2.  **Configure the extension in VS Code:**
    *   Open **Settings** (`Ctrl+,` or `Cmd+,`).
    *   Search for `Solidtime`.
    *   Enter your credentials in the following fields:
        *   `solidtime-vscode-extension.apiKey`: Your Solidtime API key.
        *   `solidtime-vscode-extension.organizationId`: Your Solidtime organization ID.
        *   `solidtime-vscode-extension.apiUrl`: The URL of your Solidtime instance (the default is `https://app.solidtime.io/`).

## How It Works

The extension activates when you open VS Code. It uses your workspace folder name as the project identifier. It then checks your Solidtime account to see if a project with that name exists. If it doesn't, one will be created for you automatically.

Activity is tracked based on typing and window focus. If you're idle or switch to another application, the tracker will pause. When you return to VS Code and resume activity, the tracker starts again.

## Development

Interested in contributing? Here's how to get started:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/1M4nt0/solidtime-vscode-extension.git
    cd solidtime-vscode-extension
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the extension:**
    ```bash
    npm run build
    ```
    Or, for development with watch mode:
    ```bash
    npm run watch
    ```

4.  **Run in VS Code:**
    *   Press `F5` to open a new VS Code window with the extension loaded (the Extension Development Host).
    *   You can see logs from the extension in the "Output" panel by selecting "Solidtime VSCode Extension" from the dropdown.

## License

This extension is licensed under the [MIT License](LICENSE).