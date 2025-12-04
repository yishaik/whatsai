# WhatsApp AI Generator

This is a web-based application that simulates a WhatsApp chat interface, but with a twist. Instead of talking to people, you're talking to AI-powered personas. You can create different AI characters with unique personalities and have conversations with them in a one-on-one or group chat setting.

## Features

- **WhatsApp-like UI:** The application mimics the look and feel of WhatsApp, providing a familiar and intuitive user experience.
- **AI Personas:** Create and manage a list of AI characters, each with their own name, avatar, and system prompt that defines their personality and behavior.
- **Direct and Group Chats:** Start one-on-one conversations with your AI personas or create group chats with multiple characters.
- **OpenRouter Integration:** The application uses the OpenRouter API to power the AI conversations, allowing you to choose from a variety of large language models.
- **Image Support:** Send images to the AI and get responses based on the visual content.
- **Local Storage:** Your API key, model selection, characters, and chats are all saved in your browser's local storage, so you don't have to reconfigure everything every time you open the app.

## Tech Stack

- **React:** The application is built using the React library for building user interfaces.
- **Vite:** The project uses Vite as a build tool and development server.
- **Tailwind CSS:** The UI is styled using Tailwind CSS, a utility-first CSS framework.
- **Lucide React:** The icons used in the application are from the Lucide React icon library.
- **OpenRouter API:** The AI chat functionality is powered by the OpenRouter API.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- **Node.js and npm:** Make sure you have Node.js and npm installed on your machine. You can download them from [here](https://nodejs.org/).
- **OpenRouter API Key:** You'll need an API key from [OpenRouter](https://openrouter.ai/) to use the AI chat functionality.

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your_username/whatsai.git
    ```
2.  **Navigate to the project directory**
    ```sh
    cd whatsai
    ```
3.  **Install NPM packages**
    ```sh
    npm install
    ```
4.  **Start the development server**
    ```sh
    npm run start
    ```
    This will start the development server and open the application in your browser at `http://localhost:7777`.

## Usage

1.  **Set your API Key:** The first time you open the app, you'll be prompted to enter your OpenRouter API key. Click on the settings icon and paste your key in the input field.
2.  **Choose a model:** Select a language model from the dropdown menu.
3.  **Create a character:** Click on the "Create AI Character" button to create a new AI persona. Give it a name, an avatar URL, and a system prompt that defines its personality.
4.  **Start a chat:** Click on the "New Chat" button to start a new conversation with one of your AI characters.
5.  **Send messages:** Type your message in the input field and press Enter to send it. You can also send images by clicking the attachment icon.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
