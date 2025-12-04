# Instructions

This document provides instructions on how to set up, run, and use the WhatsApp AI Generator application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Usage](#usage)
- [Modifying the Application](#modifying-the-application)

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js:** This application requires Node.js to run. You can download it from [nodejs.org](https://nodejs.org/).
- **npm:** The Node.js package manager, which comes with the Node.js installation.
- **A modern web browser:** Such as Chrome, Firefox, or Safari.

You will also need an **OpenRouter API Key**. You can get one for free from the [OpenRouter.ai](https://openrouter.ai/) website.

## Installation

1.  **Download the project files:** You should have a folder containing the following files:
    - `index.html`
    - `package.json`
    - `vite.config.js`
    - `tailwind.config.js`
    - `postcss.config.js`
    - `README.md`
    - `INSTRUCTIONS.md`
    - `src/`
        - `App.js`
        - `main.jsx`
        - `index.css`

2.  **Open a terminal or command prompt** in the project's root directory.

3.  **Install the dependencies** by running the following command:

    ```bash
    npm install
    ```

    This will download and install all the necessary packages for the application to run.

## Running the Application

Once the installation is complete, you can start the development server by running:

```bash
npm run start
```

This will start the application and make it available on your local network at `http://localhost:7777`. Your browser should automatically open to this address.

## Usage

1.  **Set Your API Key:**
    - The first time you open the application, you'll see a message prompting you to set your API key.
    - Click the **Settings** icon (a cogwheel) in the top-left header.
    - Paste your OpenRouter API key into the "OpenRouter API Key" field.
    - Click "Save and Close".

2.  **Select an AI Model:**
    - In the Settings modal, you can also choose which AI model you want to interact with from the dropdown list.
    - Some models support vision (the ability to "see" and describe images), while others are text-only.

3.  **Create an AI Character:**
    - Click the **New AI Character** icon (a robot head) in the header.
    - **Name:** Give your character a name (e.g., "Shakespeare," "Wise Sage").
    - **Image (URL):** Provide a link to an image to be used as the character's avatar.
    - **System Prompt:** This is the most important part. Write a description of the character's personality, tone, and background. This prompt will guide the AI's responses. For example: `You are a grumpy cat who secretly enjoys poetry. You respond in short, cynical rhymes.`
    - Click "Create Character".

4.  **Start a Chat:**
    - **Direct Chat:** Click the **New Chat** icon (a speech bubble), then select the character you want to talk to.
    - **Group Chat:** Click the **New Group** icon (multiple users), give the group a name, select the characters you want to include, and click "Create Group".

5.  **Interact:**
    - Type a message in the input box at the bottom and press Enter.
    - To send an image, click the **Plus** icon and select an image file from your computer. The AI characters with vision capabilities will be able to comment on the image.

## Modifying the Application

The application is built with React and Vite, making it easy to modify.

- **Source Code:** The main application logic is located in `src/App.js`. You can edit this file to change the UI, add new features, or modify existing behavior.
- **Styling:** The application uses Tailwind CSS. You can modify the styles by editing the class names in `src/App.js` or by configuring `tailwind.config.js`.
- **Dependencies:** If you want to add new libraries, you can add them to `package.json` and run `npm install`.

After making any changes to the code, the development server will automatically reload the application in your browser.
