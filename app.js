require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');

const getPort = () => process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'Extension')));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000); // 6-digit code
}

// Function to send verification email
async function sendVerificationEmail(email, verificationCode) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification',
        text: `Your verification code is ${verificationCode}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent');
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
}

app.post('/send-verification', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    // Generate a verification code
    const verificationCode = generateVerificationCode();

    try {
        await sendVerificationEmail(email, verificationCode);
        res.json({ verificationCode });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// get the email sent in the body and create a jwt using the email, secret key and expiration date
app.post('/login', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }
    const token = jwt.sign({ user: { email: email } }, process.env.SECRET_KEY , { expiresIn: '7d' });
    // return the created token
    res.json({ token});
});

// read the md file that contains the hardcoded website list and return it
const readFileContent = async (filePath) => {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error reading or parsing file:', error);
        throw error;
    }
};

// access md file path and retrieve the data in it and return it
app.get('/websites', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'Docs/e_commerce_websites_list.md');
        const data = await readFileContent(filePath);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// add for default path the extension html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Extension', 'popup.html'));
});

// display a message showing on which port the server is listening
app.listen(getPort(), () => {
    console.log(`Server is running on port ${getPort()}`);
});