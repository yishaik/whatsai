# WhatsApp AI Generator / יוצר AI ל-WhatsApp

[![English](https://img.shields.io/badge/language-English-blue.svg)](README.md) [![Hebrew](https://img.shields.io/badge/language-Hebrew-blue.svg)](README.md#hebrew-documentation)

This is a web-based application that simulates a WhatsApp chat interface, but with a twist. Instead of talking to people, you're talking to AI-powered personas. You can create different AI characters with unique personalities and have conversations with them in a one-on-one or group chat setting.

## Features / תכונות

- **WhatsApp-like UI / ממשק דמוי WhatsApp:** The application mimics the look and feel of WhatsApp, providing a familiar and intuitive user experience.
- **AI Personas / דמויות AI:** Create and manage a list of AI characters, each with their own name, avatar, and system prompt that defines their personality and behavior.
- **Direct and Group Chats / צ'אטים פרטיים וקבוצתיים:** Start one-on-one conversations with your AI personas or create group chats with multiple characters.
- **OpenRouter Integration / אינטגרציה עם OpenRouter:** The application uses the OpenRouter API to power the AI conversations, allowing you to choose from a variety of large language models.
- **Image Support / תמיכה בתמונות:** Send images to the AI and get responses based on the visual content.
- **Local Storage / אחסון מקומי:** Your API key, model selection, characters, and chats are all saved in your browser's local storage, so you don't have to reconfigure everything every time you open the app.

## Tech Stack / טכנולוגיות

- **React:** The application is built using the React library for building user interfaces.
- **Vite:** The project uses Vite as a build tool and development server.
- **Tailwind CSS:** The UI is styled using Tailwind CSS, a utility-first CSS framework.
- **Lucide React:** The icons used in the application are from the Lucide React icon library.
- **OpenRouter API:** The AI chat functionality is powered by the OpenRouter API.

## Getting Started / התחלה מהירה

To get a local copy up and running, follow these simple steps.

### Prerequisites / דרישות מוקדמות

- **Node.js and npm:** Make sure you have Node.js and npm installed on your machine. You can download them from [here](https://nodejs.org/).
- **OpenRouter API Key:** You'll need an API key from [OpenRouter](https://openrouter.ai/) to use the AI chat functionality.

### Installation / התקנה

1.  **Clone the repo / שיבוט הרפוזיטורי**
    ```sh
    git clone https://github.com/your_username/whatsai.git
    ```
2.  **Navigate to the project directory / מעבר לתיקיית הפרויקט**
    ```sh
    cd whatsai
    ```
3.  **Install NPM packages / התקנת חבילות NPM**
    ```sh
    npm install
    ```
4.  **Start the development server / הפעלת שרת פיתוח**
    ```sh
    npm run start
    ```
    This will start the development server and open the application in your browser at `http://localhost:7777`.

## Usage / שימוש

1.  **Set your API Key / הגדרת מפתח API:** The first time you open the app, you'll be prompted to enter your OpenRouter API key. Click on the settings icon and paste your key in the input field.
2.  **Choose a model / בחירת מודל:** Select a language model from the dropdown menu.
3.  **Create a character / יצירת דמות:** Click on the "Create AI Character" button to create a new AI persona. Give it a name, an avatar URL, and a system prompt that defines its personality.
4.  **Start a chat / התחלת צ'אט:** Click on the "New Chat" button to start a new conversation with one of your AI characters.
5.  **Send messages / שליחת הודעות:** Type your message in the input field and press Enter to send it. You can also send images by clicking the attachment icon.

## Deployment Options / אפשרויות פריסה

The application can be deployed in several ways:

### Cloudflare Pages (Recommended / מומלץ)
- Fully static hosting with global CDN
- Automatic deploys on GitHub push
- No server management required

### Self-hosted Static Preview / פריסה עצמאית
- Run locally with Cloudflare Tunnel
- Use systemd for persistent service
- Full control over hosting environment

### GitHub Pages / דפי GitHub
- Simple deployment using GitHub Actions
- Free hosting for static sites
- Easy integration with GitHub repositories

For detailed deployment instructions, see the [Deployment Guide](deploy/README.md).

## Contributing / תרומה

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Don't forget to give the project a star! Thanks again!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## Code Maintenance / תחזוקת קוד

- **Code Style:** Follow consistent code style and formatting
- **Testing:** Add tests for new features and bug fixes
- **Documentation:** Update documentation when making changes
- **Dependencies:** Keep dependencies up to date
- **Performance:** Optimize code for better performance

## License / רישיון

Distributed under the MIT License. See `LICENSE` for more information.

---

# Hebrew Documentation / תיעוד בעברית

## מבוא

WhatsApp AI Generator הוא יישום אינטרנטי המדמה ממשק צ'אט של WhatsApp, אך עם פיתול ייחודי. במקום לדבר עם אנשים, אתם מדברים עם דמויות המופעלות על ידי בינה מלאכותית. ניתן ליצור דמויות AI שונות עם אישיות ייחודית ולנהל איתן שיחות בצ'אט פרטי או קבוצתי.

## תכונות עיקריות

- **ממשק דמוי WhatsApp:** היישום מחקה את המראה והתחושה של WhatsApp, ומספק חווית משתמש מוכרת ואינטואיטיבית.
- **דמויות AI:** יצירה וניהול של רשימת דמויות AI, לכל אחת עם שם, אבטר ופרומפט מערכת שמגדיר את האישיות והתנהגותה.
- **צ'אטים פרטיים וקבוצתיים:** התחלת שיחות אחד על אחד עם דמויות ה-AI שלך או יצירת צ'אטים קבוצתיים עם מספר דמויות.
- **אינטגרציה עם OpenRouter:** היישום משתמש ב-API של OpenRouter כדי להניע את השיחות עם ה-AI, ומאפשר לבחור ממגוון מודלים של שפה גדולה.
- **תמיכה בתמונות:** שליחת תמונות ל-AI וקבלת תגובות המבוססות על התוכן הוויזואלי.
- **אחסון מקומי:** מפתח ה-API, בחירת המודל, הדמויות והצ'אטים נשמרים כולם באחסון המקומי של הדפדפן, כך שלא צריך להגדיר הכל מחדש בכל פעם שפותחים את האפליקציה.

## טכנולוגיות

- **React:** האפליקציה נבנתה באמצעות ספריית React לבניית ממשקי משתמש.
- **Vite:** הפרויקט משתמש ב-Vite ככלי בנייה ושרת פיתוח.
- **Tailwind CSS:** הממשק מעוצב באמצעות Tailwind CSS, מסגרת CSS מבוססת תכונות.
- **Lucide React:** האייקונים המשמשים באפליקציה הם מספריית האייקונים Lucide React.
- **OpenRouter API:** פונקציית הצ'אט של ה-AI מופעלת באמצעות ה-API של OpenRouter.

## התחלה מהירה

כדי לקבל עותק מקומי ולהריץ אותו, עקבו אחר השלבים הפשוטים האלה.

### דרישות מוקדמות

- **Node.js ו-npm:** ודאו שיש לכם Node.js ו-npm מותקנים במחשב. ניתן להוריד אותם מ-[כאן](https://nodejs.org/).
- **מפתח API של OpenRouter:** תצטרכו מפתח API מ-[OpenRouter](https://openrouter.ai/) כדי להשתמש בפונקציית הצ'אט של ה-AI.

### התקנה

1.  **שיבוט הרפוזיטורי**
    ```sh
    git clone https://github.com/your_username/whatsai.git
    ```
2.  **מעבר לתיקיית הפרויקט**
    ```sh
    cd whatsai
    ```
3.  **התקנת חבילות NPM**
    ```sh
    npm install
    ```
4.  **הפעלת שרת פיתוח**
    ```sh
    npm run start
    ```
    זה יפעיל את שרת הפיתוח ויפתח את האפליקציה בדפדפן שלכם בכתובת `http://localhost:7777`.

## שימוש

1.  **הגדרת מפתח API:** בפעם הראשונה שאתם פותחים את האפליקציה, תתבקשו להזין את מפתח ה-API של OpenRouter. לחצו על אייקון ההגדרות והדביקו את המפתח בשדה הקלט.
2.  **בחירת מודל:** בחרו מודל שפה מהתפריט הנפתח.
3.  **יצירת דמות:** לחצו על כפתור "Create AI Character" כדי ליצור דמות AI חדשה. תנו לה שם, כתובת URL לאבטר ופרומפט מערכת שמגדיר את האישיות שלה.
4.  **התחלת צ'אט:** לחצו על כפתור "New Chat" כדי להתחיל שיחה חדשה עם אחת מדמויות ה-AI שלכם.
5.  **שליחת הודעות:** הקלידו את ההודעה שלכם בשדה הקלט ולחצו Enter כדי לשלוח אותה. ניתן גם לשלוח תמונות על ידי לחיצה על אייקון הקובץ המצורף.

## אפשרויות פריסה

האפליקציה יכולה להיות מופצת בכמה דרכים:

### Cloudflare Pages (מומלץ)
- אירוח סטטי מלא עם CDN גלובלי
- פריסות אוטומטיות עם דחיפה ל-GitHub
- אין צורך בניהול שרת

### פריסה עצמאית
- הרצה מקומית עם Cloudflare Tunnel
- שימוש ב-systemd לשירות קבוע
- שליטה מלאה על סביבת האירוח

### דפי GitHub
- פריסה פשוטה באמצעות GitHub Actions
- אירוח חינמי לאתרים סטטיים
- אינטגרציה קלה עם רפוזיטוריות GitHub

להנחיות פריסה מפורטות, ראו את [מדריך הפריסה](deploy/README.md).

## תרומה

תרומות הן מה שהופך את קהילת הקוד הפתוח למקום מדהים ללמוד, להשראות וליצור. כל תרומה שאתם עושים היא **מוערכת מאוד**.

אם יש לכם הצעה שתשפר את הפרויקט, אנא עשו fork לרפוזיטורי וצרו pull request. ניתן גם פשוט לפתוח issue עם התגית "enhancement".

אל תשכחו לתת כוכב לפרויקט! תודה רבה!

1.  עשו Fork לפרויקט
2.  צרו ענף תכונה (`git checkout -b feature/AmazingFeature`)
3.  בצעו Commit לשינויים (`git commit -m 'Add some AmazingFeature'`)
4.  דחפו לענף (`git push origin feature/AmazingFeature`)
5.  צרו Pull Request

## תחזוקת קוד

- **סגנון קוד:** עקבו אחר סגנון קוד ועיצוב עקיבים
- **בדיקות:** הוסיפו בדיקות לתכונות חדשות ולתיקוני באגים
- **תיעוד:** עדכנו תיעוד בעת ביצוע שינויים
- **תלויות:** שמרו על תלויות מעודכנות
- **ביצועים:** אופטימיזציה של קוד לביצועים טובים יותר

## רישיון

מופץ תחת רישיון MIT. ראו `LICENSE` למידע נוסף.
