# Contributing Guide / מדריך תרומה

[![English](https://img.shields.io/badge/language-English-blue.svg)](CONTRIBUTING.md) [![Hebrew](https://img.shields.io/badge/language-Hebrew-blue.svg)](CONTRIBUTING.md#hebrew-contributing-guide)

Thank you for your interest in contributing to WhatsApp AI Generator! This guide will help you get started with contributing to the project.

## Table of Contents / תוכן עניינים

- [Code of Conduct / קוד התנהגות](#code-of-conduct-קוד-התנהגות)
- [How to Contribute / איך לתרום](#how-to-contribute-איך-לתרום)
- [Development Setup / הגדרת סביבת פיתוח](#development-setup-הגדרת-סביבת-פיתוח)
- [Code Style Guidelines / הנחיות סגנון קוד](#code-style-guidelines-הנחיות-סגנון-קוד)
- [Testing / בדיקות](#testing-בדיקות)
- [Documentation / תיעוד](#documentation-תיעוד)
- [Pull Request Process / תהליך Pull Request](#pull-request-process-תהליך-pull-request)
- [Code Review / סקירת קוד](#code-review-סקירת-קוד)
- [Maintenance / תחזוקה](#maintenance-תחזוקה)

## Code of Conduct / קוד התנהגות

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to understand the expected behavior.

## How to Contribute / איך לתרום

### Reporting Bugs / דיווח על באגים

1. **Search existing issues** before creating a new one
2. **Provide detailed information:**
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Browser and OS information
3. **Use the bug report template** when available

### Suggesting Features / הצעת תכונות

1. **Check if the feature already exists**
2. **Describe the feature clearly:**
   - What problem it solves
   - How it should work
   - Potential alternatives
3. **Provide examples or mockups** if possible

### Submitting Code / הגשת קוד

1. **Fork the repository** and create a feature branch
2. **Follow the code style guidelines**
3. **Write tests** for your changes
4. **Update documentation** if needed
5. **Submit a pull request**

## Development Setup / הגדרת סביבת פיתוח

### Prerequisites / דרישות מוקדמות

- Node.js (v18+ recommended)
- npm or yarn
- Git
- Code editor (VS Code recommended)

### Setup Steps / שלבי הגדרה

```bash
# Clone the repository
git clone https://github.com/your_username/whatsai.git
cd whatsai

# Install dependencies
npm install

# Start development server
npm run start
```

### Recommended Extensions / הרחבות מומלצות

- **VS Code:**
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - GitLens

## Code Style Guidelines / הנחיות סגנון קוד

### JavaScript/React / JavaScript/React

1. **Naming Conventions / אמנויות שמות:**
   - Use camelCase for variables and functions
   - Use PascalCase for components
   - Use UPPER_CASE for constants
   - Use descriptive names

2. **Component Structure / מבנה רכיבים:**
   - Keep components small and focused
   - Use functional components with hooks
   - Separate logic from presentation when complex

3. **Code Formatting / עיצוב קוד:**
   - Use 2 spaces for indentation
   - Use single quotes for strings
   - Add semicolons
   - Keep lines under 100 characters

### CSS/Tailwind / CSS/Tailwind

1. **Class Naming / שמות מחלקות:**
   - Use meaningful class names
   - Follow BEM-like naming conventions
   - Avoid overly specific selectors

2. **Tailwind Usage / שימוש ב-Tailwind:**
   - Prefer utility classes over custom CSS
   - Use @apply for repeated utility combinations
   - Keep custom CSS minimal

### Project Structure / מבנה פרויקט

- `src/` - Main application code
  - `components/` - Reusable components
  - `App.js` - Main application logic
  - `main.jsx` - Entry point
- `public/` - Static assets
- `deploy/` - Deployment configurations
- `docs/` - Documentation

## Testing / בדיקות

### Testing Framework / מסגרת בדיקות

- **Jest** for unit testing
- **React Testing Library** for component testing
- **Cypress** for end-to-end testing (future)

### Writing Tests / כתיבת בדיקות

1. **Unit Tests / בדיקות יחידה:**
   - Test pure functions and utilities
   - Aim for high coverage of critical logic
   - Keep tests focused and fast

2. **Component Tests / בדיקות רכיבים:**
   - Test component rendering
   - Test user interactions
   - Mock external dependencies

3. **Integration Tests / בדיקות אינטגרציה:**
   - Test component interactions
   - Test data flow
   - Test API integrations

### Running Tests / הרצת בדיקות

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

## Documentation / תיעוד

### Documentation Standards / תקני תיעוד

1. **Code Comments / הערות קוד:**
   - Explain complex logic
   - Document function parameters and return values
   - Update comments when code changes

2. **README Updates / עדכוני README:**
   - Update for new features
   - Add usage examples
   - Document breaking changes

3. **API Documentation / תיעוד API:**
   - Document all public APIs
   - Include parameter types and examples
   - Document error cases

### Documentation Tools / כלי תיעוד

- **Markdown** for documentation files
- **JSDoc** for code documentation
- **Diagrams** for architecture (Mermaid.js)

## Pull Request Process / תהליך Pull Request

### Before Submitting / לפני הגשה

1. **Rebase your branch** on latest main
2. **Run all tests** and ensure they pass
3. **Check linting** and formatting
4. **Update documentation** if needed
5. **Review your changes** thoroughly

### Submitting the PR / הגשת ה-PR

1. **Use a clear title** describing the change
2. **Provide a detailed description:**
   - What problem it solves
   - How it solves it
   - Any breaking changes
3. **Reference related issues**
4. **Add appropriate labels**

### PR Template / תבנית PR

```markdown
## Description

[Clear description of the changes]

## Related Issues

[List of related issues, e.g., Closes #123]

## Changes Made

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Test addition/improvement

## Breaking Changes

[List any breaking changes or migration steps]

## Testing

[Describe how the changes were tested]

## Screenshots

[Add screenshots if applicable]
```

## Code Review / סקירת קוד

### Review Process / תהליך סקירה

1. **At least one approval** required
2. **Address all feedback** before merging
3. **Small, focused PRs** preferred
4. **Be responsive** to review comments

### Review Checklist / רשימת בדיקה לסקירה

- [ ] Code follows style guidelines
- [ ] Tests cover new functionality
- [ ] Documentation is updated
- [ ] No breaking changes without migration path
- [ ] Performance considerations addressed
- [ ] Security implications considered

## Maintenance / תחזוקה

### Versioning / גרסאות

- Follow **Semantic Versioning** (MAJOR.MINOR.PATCH)
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Release Process / תהליך שחרור

1. **Update changelog** with all changes
2. **Tag the release** in Git
3. **Create GitHub release** with notes
4. **Update documentation** if needed
5. **Announce the release**

### Dependency Management / ניהול תלויות

1. **Regular updates**
   - Check for updates weekly
   - Test updates before merging
   - Update in dedicated PRs

2. **Security updates**
   - Prioritize security patches
   - Update immediately for critical vulnerabilities
   - Document security fixes

### Performance Optimization / אופטימיזציה של ביצועים

1. **Monitor performance** regularly
2. **Optimize critical paths**
3. **Use memoization** where appropriate
4. **Minimize re-renders**
5. **Bundle size optimization**

---

# Hebrew Contributing Guide / מדריך תרומה בעברית

## תוכן עניינים

- [קוד התנהגות](#קוד-התנהגות)
- [איך לתרום](#איך-לתרום)
- [הגדרת סביבת פיתוח](#הגדרת-סביבת-פיתוח)
- [הנחיות סגנון קוד](#הנחיות-סגנון-קוד)
- [בדיקות](#בדיקות)
- [תיעוד](#תיעוד)
- [תהליך Pull Request](#תהליך-pull-request)
- [סקירת קוד](#סקירת-קוד)
- [תחזוקה](#תחזוקה)

## קוד התנהגות

על ידי השתתפות בפרויקט זה, אתם מסכימים לפעול לפי [קוד ההתנהגות](CODE_OF_CONDUCT.md) שלנו. אנא קראו אותו כדי להבין את ההתנהגות הצפויה.

## איך לתרום

### דיווח על באגים

1. **חפשו בעיות קיימות** לפני יצירת אחת חדשה
2. **ספקו מידע מפורט:**
   - שלבים לשחזור
   - התנהגות צפויה לעומת התנהגות בפועל
   - צילומי מסך אם רלוונטי
   - מידע על דפדפן ומערכת הפעלה
3. **השתמשו בתבנית דיווח הבאג** כאשר זמינה

### הצעת תכונות

1. **בדקו אם התכונה כבר קיימת**
2. **תארו את התכונה בבירור:**
   - איזו בעיה היא פותרת
   - איך היא צריכה לעבוד
   - חלופות פוטנציאליות
3. **ספקו דוגמאות או מוקאפים** אם אפשר

### הגשת קוד

1. **עשו Fork לרפוזיטורי** וצרו ענף תכונה
2. **עקבו אחר הנחיות סגנון הקוד**
3. **כתבו בדיקות** לשינויים שלכם
4. **עדכנו תיעוד** אם נדרש
5. **הגישו Pull Request**

## הגדרת סביבת פיתוח

### דרישות מוקדמות

- Node.js (גרסה 18+ מומלצת)
- npm או yarn
- Git
- עורך קוד (VS Code מומלץ)

### שלבי הגדרה

```bash
# שיבוט הרפוזיטורי
git clone https://github.com/your_username/whatsai.git
cd whatsai

# התקנת תלויות
npm install

# הפעלת שרת פיתוח
npm run start
```

### הרחבות מומלצות

- **VS Code:**
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - GitLens

## הנחיות סגנון קוד

### JavaScript/React

1. **אמנויות שמות:**
   - השתמשו ב-camelCase למשתנים ופונקציות
   - השתמשו ב-PascalCase לרכיבים
   - השתמשו ב-UPPER_CASE לקבועים
   - השתמשו בשמות תיאוריים

2. **מבנה רכיבים:**
   - שמרו על רכיבים קטנים ומרוכזים
   - השתמשו ברכיבים פונקציונליים עם hooks
   - הפרדו לוגיקה מהצגה כאשר מורכב

3. **עיצוב קוד:**
   - השתמשו ב-2 רווחים לכיווץ
   - השתמשו בגרשים בודדים למחרוזות
   - הוסיפו נקודה-פסיק
   - שמרו על שורות מתחת ל-100 תווים

### CSS/Tailwind

1. **שמות מחלקות:**
   - השתמשו בשמות מחלקות משמעותיים
   - עקבו אחר אמנויות שמות דמויות BEM
   - הימנעו מסלקטורים ספציפיים מדי

2. **שימוש ב-Tailwind:**
   - העדיפו מחלקות תכונה על פני CSS מותאם
   - השתמשו ב-@apply עבור צירופי תכונות חוזרים
   - שמרו על CSS מותאם למינימום

### מבנה פרויקט

- `src/` - קוד האפליקציה העיקרי
  - `components/` - רכיבים לשימוש חוזר
  - `App.js` - הלוגיקה העיקרית של האפליקציה
  - `main.jsx` - נקודת כניסה
- `public/` - נכסים סטטיים
- `deploy/` - תצורות פריסה
- `docs/` - תיעוד

## בדיקות

### מסגרת בדיקות

- **Jest** לבדיקות יחידה
- **React Testing Library** לבדיקות רכיבים
- **Cypress** לבדיקות end-to-end (עתידי)

### כתיבת בדיקות

1. **בדיקות יחידה:**
   - בדיקות של פונקציות טהורות וutilities
   - שאפו לכיסוי גבוה של לוגיקה קריטית
   - שמרו על בדיקות מוקדות ומהירות

2. **בדיקות רכיבים:**
   - בדיקות של רינדור רכיבים
   - בדיקות של אינטראקציות משתמש
   - מוקינג של תלויות חיצוניות

3. **בדיקות אינטגרציה:**
   - בדיקות של אינטראקציות בין רכיבים
   - בדיקות של זרימת נתונים
   - בדיקות של אינטגרציות API

### הרצת בדיקות

```bash
# הרצת כל הבדיקות
npm test

# הרצת בדיקות עם כיסוי
npm test -- --coverage

# הרצת בדיקות במצב watch
npm test -- --watch
```

## תיעוד

### תקני תיעוד

1. **הערות קוד:**
   - הסבירו לוגיקה מורכבת
   - תעדו פרמטרים של פונקציות וערכי החזרה
   - עדכנו הערות כאשר הקוד משתנה

2. **עדכוני README:**
   - עדכנו עבור תכונות חדשות
   - הוסיפו דוגמאות שימוש
   - תעדו שינויים שוברי קוד

3. **תיעוד API:**
   - תעדו את כל ה-APIs הציבוריים
   - כללו סוגי פרמטרים ודוגמאות
   - תעדו מקרי שגיאה

### כלי תיעוד

- **Markdown** לקבצי תיעוד
- **JSDoc** לתיעוד קוד
- **Diagrams** לארכיטקטורה (Mermaid.js)

## תהליך Pull Request

### לפני הגשה

1. **עשו rebase לענף שלכם** על הענף העיקרי האחרון
2. **הריצו את כל הבדיקות** וודאו שהן עוברות
3. **בדקו linting** ועיצוב
4. **עדכנו תיעוד** אם נדרש
5. **סקרו את השינויים שלכם** ביסודיות

### הגשת ה-PR

1. **השתמשו בכותרת ברורה** המתארת את השינוי
2. **ספקו תיאור מפורט:**
   - איזו בעיה הוא פותר
   - איך הוא פותר אותה
   - כל שינויים שוברי קוד
3. **ציטוט של בעיות קשורות**
4. **הוסיפו תגיות מתאימות**

### תבנית PR

```markdown
## תיאור

[תיאור ברור של השינויים]

## בעיות קשורות

[רשימה של בעיות קשורות, למשל, סוגר #123]

## שינויים שבוצעו

- [ ] תיקון באג
- [ ] תכונה חדשה
- [ ] עדכון תיעוד
- [ ] ריפקטורינג קוד
- [ ] הוספת/שיפור בדיקות

## שינויים שוברי קוד

[רשימה של שינויים שוברי קוד או שלבי מיגרציה]

## בדיקות

[תיאור של איך השינויים נבדקו]

## צילומי מסך

[הוסיפו צילומי מסך אם רלוונטי]
```

## סקירת קוד

### תהליך סקירה

1. **נדרשת לפחות אישור אחד**
2. **טפלו בכל המשוב** לפני מיזוג
3. **PRs קטנים ומרוכזים** מועדפים
4. **היו רספונסיביים** להערות סקירה

### רשימת בדיקה לסקירה

- [ ] הקוד עוקב אחר הנחיות הסגנון
- [ ] הבדיקות מכסות את הפונקציונליות החדשה
- [ ] התיעוד מעודכן
- [ ] אין שינויים שוברי קוד ללא מסלול מיגרציה
- [ ] שיקולי ביצועים טופלו
- [ ] השפעות אבטחה נלקחו בחשבון

## תחזוקה

### גרסאות

- עקבו אחר **גרסאות סמנטיות** (MAJOR.MINOR.PATCH)
- MAJOR: שינויים שוברי קוד
- MINOR: תכונות חדשות (תואם אחורה)
- PATCH: תיקוני באגים (תואם אחורה)

### תהליך שחרור

1. **עדכנו יומן שינויים** עם כל השינויים
2. **תייגו את השחרור** ב-Git
3. **צרו שחרור GitHub** עם הערות
4. **עדכנו תיעוד** אם נדרש
5. **הודיעו על השחרור**

### ניהול תלויות

1. **עדכונים קבועים**
   - בדקו עדכונים באופן שבועי
   - בדקו עדכונים לפני מיזוג
   - עדכנו ב-PRs ייעודיים

2. **עדכוני אבטחה**
   - העדיפו תיקוני אבטחה
   - עדכנו מיד עבור פגיעויות קריטיות
   - תעדו תיקוני אבטחה

### אופטימיזציה של ביצועים

1. **עקבו אחר ביצועים** באופן קבוע
2. **אופטימיזציה של מסלולים קריטיים**
3. **השתמשו במימוזציה** כאשר מתאים
4. **מזערו re-renders**
5. **אופטימיזציה של גודל bundle**