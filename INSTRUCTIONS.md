# Instructions / הוראות

[![English](https://img.shields.io/badge/language-English-blue.svg)](INSTRUCTIONS.md) [![Hebrew](https://img.shields.io/badge/language-Hebrew-blue.svg)](INSTRUCTIONS.md#hebrew-instructions)

This document provides instructions on how to set up, run, and use the WhatsApp AI Generator application.

## Table of Contents / תוכן עניינים

- [Prerequisites / דרישות מוקדמות](#prerequisites-דרישות-מוקדמות)
- [Installation / התקנה](#installation-התקנה)
- [Running the Application / הפעלת האפליקציה](#running-the-application-הפעלת-האפליקציה)
- [Usage / שימוש](#usage-שימוש)
- [Modifying the Application / שינוי האפליקציה](#modifying-the-application-שינוי-האפליקציה)
- [Code Maintenance / תחזוקת קוד](#code-maintenance-תחזוקת-קוד)

## Prerequisites / דרישות מוקדמות

Before you begin, ensure you have the following installed on your system:

- **Node.js:** This application requires Node.js to run. You can download it from [nodejs.org](https://nodejs.org/).
- **npm:** The Node.js package manager, which comes with the Node.js installation.
- **A modern web browser:** Such as Chrome, Firefox, or Safari.

You will also need an **OpenRouter API Key**. You can get one for free from the [OpenRouter.ai](https://openrouter.ai/) website.

## Installation / התקנה

1.  **Download the project files / הורדת קבצי הפרויקט:** You should have a folder containing the following files:
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

2.  **Open a terminal or command prompt / פתיחת מסוף או שורת פקודה** in the project's root directory.

3.  **Install the dependencies / התקנת התלויות** by running the following command:

    ```bash
    npm install
    ```

    This will download and install all the necessary packages for the application to run.

## Running the Application / הפעלת האפליקציה

Once the installation is complete, you can start the development server by running:

```bash
npm run start
```

This will start the application and make it available on your local network at `http://localhost:7777`. Your browser should automatically open to this address.

## Usage / שימוש

1.  **Set Your API Key / הגדרת מפתח API:**
    - The first time you open the application, you'll see a message prompting you to set your API key.
    - Click the **Settings** icon (a cogwheel) in the top-left header.
    - Paste your OpenRouter API key into the "OpenRouter API Key" field.
    - Click "Save and Close".

2.  **Select an AI Model / בחירת מודל AI:**
    - In the Settings modal, you can also choose which AI model you want to interact with from the dropdown list.
    - Some models support vision (the ability to "see" and describe images), while others are text-only.

3.  **Create an AI Character / יצירת דמות AI:**
    - Click the **New AI Character** icon (a robot head) in the header.
    - **Name / שם:** Give your character a name (e.g., "Shakespeare," "Wise Sage").
    - **Image (URL) / תמונה (URL):** Provide a link to an image to be used as the character's avatar.
    - **System Prompt / פרומפט מערכת:** This is the most important part. Write a description of the character's personality, tone, and background. This prompt will guide the AI's responses. For example: `You are a grumpy cat who secretly enjoys poetry. You respond in short, cynical rhymes.`
    - Click "Create Character".

4.  **Start a Chat / התחלת צ'אט:**
    - **Direct Chat / צ'אט פרטי:** Click the **New Chat** icon (a speech bubble), then select the character you want to talk to.
    - **Group Chat / צ'אט קבוצתי:** Click the **New Group** icon (multiple users), give the group a name, select the characters you want to include, and click "Create Group".

5.  **Interact / אינטראקציה:**
    - Type a message in the input box at the bottom and press Enter.
    - To send an image, click the **Plus** icon and select an image file from your computer. The AI characters with vision capabilities will be able to comment on the image.

## Modifying the Application / שינוי האפליקציה

The application is built with React and Vite, making it easy to modify.

- **Source Code / קוד מקור:** The main application logic is located in `src/App.js`. You can edit this file to change the UI, add new features, or modify existing behavior.
- **Styling / עיצוב:** The application uses Tailwind CSS. You can modify the styles by editing the class names in `src/App.js` or by configuring `tailwind.config.js`.
- **Dependencies / תלויות:** If you want to add new libraries, you can add them to `package.json` and run `npm install`.

After making any changes to the code, the development server will automatically reload the application in your browser.

## Code Maintenance / תחזוקת קוד

### Best Practices / שיטות עבודה מומלצות

1. **Code Style / סגנון קוד:**
   - Follow consistent indentation and formatting
   - Use meaningful variable and function names
   - Keep functions small and focused
   - Add comments for complex logic

2. **Testing / בדיקות:**
   - Write unit tests for critical functions
   - Test edge cases and error handling
   - Use test-driven development when possible

3. **Documentation / תיעוד:**
   - Update README and INSTRUCTIONS when making changes
   - Add inline comments for complex code
   - Document API endpoints and their usage

4. **Dependencies / תלויות:**
   - Regularly update dependencies
   - Check for security vulnerabilities
   - Document dependency requirements

5. **Performance / ביצועים:**
   - Optimize rendering and re-renders
   - Use memoization where appropriate
   - Minimize API calls and data fetching

### Development Workflow / זרימת פיתוח

1. **Feature Development / פיתוח תכונות:**
   - Create a new branch for each feature
   - Use descriptive branch names
   - Keep commits small and focused

2. **Code Review / סקירת קוד:**
   - Request reviews for major changes
   - Follow project coding standards
   - Address feedback promptly

3. **Deployment / פריסה:**
   - Test thoroughly before deployment
   - Use staging environments when possible
   - Monitor after deployment

## Troubleshooting / פתרון בעיות

### Common Issues / בעיות נפוצות

1. **Application not starting:**
   - Check Node.js and npm versions
   - Verify all dependencies are installed
   - Check for port conflicts

2. **API key not working:**
   - Verify the key is correct
   - Check OpenRouter API status
   - Ensure proper network connectivity

3. **UI rendering issues:**
   - Clear browser cache
   - Check for CSS conflicts
   - Verify React component structure

### Debugging Tips / טיפים לדיבוג

- Use browser developer tools
- Check console logs for errors
- Enable debug logging in development
- Test with different browsers

---

# Hebrew Instructions / הוראות בעברית

## תוכן עניינים

- [דרישות מוקדמות](#דרישות-מוקדמות)
- [התקנה](#התקנה)
- [הפעלת האפליקציה](#הפעלת-האפליקציה)
- [שימוש](#שימוש)
- [שינוי האפליקציה](#שינוי-האפליקציה)
- [תחזוקת קוד](#תחזוקת-קוד)

## דרישות מוקדמות

לפני שמתחילים, ודאו שיש לכם את הדברים הבאים מותקנים במערכת:

- **Node.js:** אפליקציה זו דורשת Node.js כדי לרוץ. ניתן להוריד אותו מ-[nodejs.org](https://nodejs.org/).
- **npm:** מנהל החבילות של Node.js, שמגיע עם התקנת Node.js.
- **דפדפן אינטרנט מודרני:** כמו Chrome, Firefox, או Safari.

תצטרכו גם **מפתח API של OpenRouter**. ניתן לקבל אחד בחינם מאתר [OpenRouter.ai](https://openrouter.ai/).

## התקנה

1.  **הורדת קבצי הפרויקט:** עליכם להיות עם תיקייה המכילה את הקבצים הבאים:
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

2.  **פתיחת מסוף או שורת פקודה** בתיקיית השורש של הפרויקט.

3.  **התקנת התלויות** על ידי הרצת הפקודה הבאה:

    ```bash
    npm install
    ```

    זה יוריד ויתקין את כל החבילות הנחוצות כדי שהאפליקציה תוכל לרוץ.

## הפעלת האפליקציה

לאחר שההתקנה הושלמה, ניתן להתחיל את שרת הפיתוח על ידי הרצת:

```bash
npm run start
```

זה יפעיל את האפליקציה ויעשה אותה זמינה ברשת המקומית שלכם ב-`http://localhost:7777`. הדפדפן שלכם אמור להיפתח אוטומטית לכתובת זו.

## שימוש

1.  **הגדרת מפתח API:**
    - בפעם הראשונה שאתם פותחים את האפליקציה, תראו הודעה המבקשת מכם להגדיר את מפתח ה-API.
    - לחצו על אייקון **הגדרות** (גלגל שיניים) בכותרת השמאלית העליונה.
    - הדביקו את מפתח ה-API של OpenRouter בשדה "OpenRouter API Key".
    - לחצו על "שמור וסגור".

2.  **בחירת מודל AI:**
    - בחלון ההגדרות, תוכלו גם לבחור איזה מודל AI אתם רוצים להתקשר איתו מהרשימה הנפתחת.
    - חלק מהמודלים תומכים בראייה (היכולת "לראות" ולתאר תמונות), בעוד שאחרים הם טקסט בלבד.

3.  **יצירת דמות AI:**
    - לחצו על אייקון **דמות AI חדשה** (ראש רובוט) בכותרת.
    - **שם:** תנו לדמות שלכם שם (למשל, "שקספיר", "חכם זקן").
    - **תמונה (URL):** ספקו קישור לתמונה שתשמש כאבטר של הדמות.
    - **פרומפט מערכת:** זה החלק החשוב ביותר. כתבו תיאור של אישיות הדמות, הטון והרקע שלה. פרומפט זה ינחה את תגובות ה-AI. לדוגמה: `אתה חתול מריר שאוהב בסתר שירה. אתה מגיב בחרוזים קצרים וציניים.`
    - לחצו על "צור דמות".

4.  **התחלת צ'אט:**
    - **צ'אט פרטי:** לחצו על אייקון **צ'אט חדש** (בועת דיבור), ואז בחרו את הדמות שאתם רוצים לדבר איתה.
    - **צ'אט קבוצתי:** לחצו על אייקון **קבוצה חדשה** (משתמשים מרובים), תנו לקבוצה שם, בחרו את הדמויות שאתם רוצים לכלול, ולחצו על "צור קבוצה".

5.  **אינטראקציה:**
    - הקלידו הודעה בתיבת הקלט בתחתית ולחצו Enter.
    - כדי לשלוח תמונה, לחצו על אייקון **פלוס** ובחרו קובץ תמונה מהמחשב שלכם. דמויות ה-AI עם יכולת ראייה יוכלו להגיב על התמונה.

## שינוי האפליקציה

האפליקציה נבנתה עם React ו-Vite, מה שהופך אותה לקלה לשינוי.

- **קוד מקור:** הלוגיקה העיקרית של האפליקציה נמצאת ב-`src/App.js`. תוכלו לערוך קובץ זה כדי לשנות את ה-UI, להוסיף תכונות חדשות, או לשנות התנהגות קיימת.
- **עיצוב:** האפליקציה משתמשת ב-Tailwind CSS. תוכלו לשנות את העיצוב על ידי עריכת שמות המחלקות ב-`src/App.js` או על ידי תצורה של `tailwind.config.js`.
- **תלויות:** אם אתם רוצים להוסיף ספריות חדשות, תוכלו להוסיף אותן ל-`package.json` ולהריץ `npm install`.

לאחר ביצוע שינויים בקוד, שרת הפיתוח יטען מחדש אוטומטית את האפליקציה בדפדפן שלכם.

## תחזוקת קוד

### שיטות עבודה מומלצות

1. **סגנון קוד:**
   - עקבו אחר כיווץ ועיצוב עקיבים
   - השתמשו בשמות משתנים ופונקציות משמעותיים
   - שמרו על פונקציות קטנות ומרוכזות
   - הוסיפו הערות לקוד מורכב

2. **בדיקות:**
   - כתבו בדיקות יחידה לפונקציות קריטיות
   - בדקו מקרי קצה וטיפול בשגיאות
   - השתמשו בפיתוח מונחה בדיקות כאשר אפשר

3. **תיעוד:**
   - עדכנו README ו-INSTRUCTIONS בעת ביצוע שינויים
   - הוסיפו הערות בקוד עבור קוד מורכב
   - תעדו נקודות קצה של API ושימוש בהם

4. **תלויות:**
   - עדכנו תלויות באופן קבוע
   - בדקו פגיעויות אבטחה
   - תעדו דרישות תלויות

5. **ביצועים:**
   - אופטימיזציה של רינדור ורינדורים חוזרים
   - השתמשו במימוזציה כאשר מתאים
   - מזערו קריאות API ואיסוף נתונים

### זרימת פיתוח

1. **פיתוח תכונות:**
   - צרו ענף חדש לכל תכונה
   - השתמשו בשמות ענפים תיאוריים
   - שמרו על קומיטים קטנים ומרוכזים

2. **סקירת קוד:**
   - בקשו סקירות לשינויים משמעותיים
   - עקבו אחר תקני הקידוד של הפרויקט
   - טפלו במשוב במהירות

3. **פריסה:**
   - בדקו ביסודיות לפני פריסה
   - השתמשו בסביבות בימוי כאשר אפשר
   - עקבו אחר פריסה

## פתרון בעיות

### בעיות נפוצות

1. **האפליקציה לא נפתחת:**
   - בדקו גרסאות Node.js ו-npm
   - ודאו שכל התלויות מותקנות
   - בדקו סכסוכי פורטים

2. **מפתח API לא עובד:**
   - ודאו שהמפתח נכון
   - בדקו את מצב ה-API של OpenRouter
   - ודאו חיבור רשת תקין

3. **בעיות רינדור UI:**
   - נקו את מטמון הדפדפן
   - בדקו סכסוכי CSS
   - ודאו מבנה רכיבי React

### טיפים לדיבוג

- השתמשו בכלי הפיתוח של הדפדפן
- בדקו יומני קונסולה עבור שגיאות
- הפעילו יומני דיבוג בפיתוח
- בדקו עם דפדפנים שונים
