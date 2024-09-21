
ChromeGPT is a Chrome extension that allows users to easily copy mathematical equations in MathML and LaTeX formats from ChatGPT and Wikipedia. This extension simplifies the process of copying and using mathematical equations in different contexts, such as in Word documents or LaTeX editors.


##
Features
##
Copy to Word (MathML): Users can copy equations in MathML format to paste into Word or other compatible editors.
Copy to LaTeX: Allows users to copy equations in LaTeX format for use in LaTeX editors.
Supports ChatGPT and Wikipedia platforms for easy access to math content.
Dark mode support: The extension adapts to the user's dark or light mode preference for a seamless experience.
Responsive design for both desktop and Android platforms.
Convert to Excel formulas.
Will work on some other websites too!


##
Installation
##

Download or clone the repository.

Copy code
git clone https://github.com/caldev1/ChromeGPT
Open Google Chrome and navigate to chrome://extensions/.

Enable Developer mode in the top right corner.

Click on Load unpacked and select the folder where the repository is cloned or downloaded.

The Equation extension should now appear in your extensions list.


##
Usage
##

Open ChatGPT or a Wikipedia article with mathematical equations.

Right-click on a math equation to open the context menu.

The context menu will display two options:

Copy to Word (MathML): Copies the equation in MathML format.
Copy to LaTeX: Copies the equation in LaTeX format.
Paste the copied content into your desired platform (e.g., Microsoft Word or LaTeX editor).

##
File Structure
##

manifest.json: Contains the metadata and configuration for the Chrome extension.
content.js: The main script that injects the context menu and handles the logic for copying MathML and LaTeX content.
contextMenu.css: Styles for the custom context menu that appears when right-clicking on an equation.
icons: Contains the icons used for the extension in different sizes (16x16, 32x32, 48x48, 128x128).


##
Contributing
##

Contributions are welcome! Please follow the steps below:

Fork the repository.
Create a new branch (git checkout -b feature/your-feature-name).
Commit your changes (git commit -m 'Add some feature').
Push to the branch (git push origin feature/your-feature-name).
Open a pull request.
License
This project is licensed under the MIT License. See the LICENSE file for details.

Credits
Created by caldev1