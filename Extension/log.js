import { registerUser, loginUser, getAllFavorites, populateWebsiteTable, sendVerificationCode } from './db.js';

async function flip_user_status(user, status) {
    try {
        switch (status) {
            case 'signUp':
                await registerUser(user);
                return 'success';
            
            case 'login':
                const { token, user: loggedInUser } = await loginUser(user);
                const { websites } = await populateWebsiteTable();
                const fav = await getAllFavorites(loggedInUser.email);

                await new Promise((resolve, reject) => {
                    chrome.storage.local.set({ AuthToken: token, Websites: websites, User: loggedInUser, Favorites: fav }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Error setting data:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });
                return 'success';
            
            default:
                return 'fail';
        }
    } catch (error) {
        console.error('Error in flip_user_status:', error.message || error);
        return 'fail';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    function validatePassword(password) {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        return passwordRegex.test(password);
    }

    chrome.storage.local.get(['AuthToken', 'Websites', 'User', 'Status', 'Favorites'], async (result) => {
        if (result.AuthToken) {
            const profileURL = chrome.runtime.getURL('profile.html');
            window.location.href = profileURL;
            return;
        }

        const feedbackMessage = document.getElementById('feedback-message');
        const loginButton = document.getElementById('login');
        const signUpButton = document.getElementById('signUp');
        const loginForm = document.getElementById('login-form');
        const signUpForm = document.getElementById('sign-up-form');
        const verifyEmail = document.getElementById('verify-email-form');
        const verifyButton = document.getElementById('verify-button'); // Ensure you have a button with id 'verify-button'

        if (signUpButton && signUpForm) {
            signUpButton.addEventListener('click', () => {
                signUpForm.style.display = 'block';
                loginForm.style.display = 'none';
                verifyEmail.style.display = 'none';
            });

            const signUpFormElement = document.getElementById('signUpForm');
            signUpFormElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                const signFirstName = document.getElementById('signup-first-name').value;
                const signLastName = document.getElementById('signup-last-name').value;
                const signEmail = document.getElementById('signup-email').value;
                const signPassword = document.getElementById('signup-password').value;
                const signPassword2 = document.getElementById('signup-password2').value;

                if (signPassword !== signPassword2) {
                    feedbackMessage.textContent = "Passwords don't match.";
                    return;
                }

                if (!validatePassword(signPassword)) {
                    feedbackMessage.textContent = 'Password must be at least 8 characters long and contain at least one number.';
                    return;
                }

                try {
                    // Step 1: Send Verification Code
                    const verificationCode = String(await sendVerificationCode(signEmail));

                    // Display verification input field to the user
                    verifyEmail.style.display = 'block';
                    signUpForm.style.display = 'none';

                    // Handle the verification code
                    verifyButton.addEventListener('click', async () => {
                        const userCodeInput = document.getElementById('code').value.trim();

                        if (userCodeInput === verificationCode) {
                            const user = {
                                email: signEmail,
                                firstName: signFirstName,
                                lastName: signLastName,
                                password: signPassword
                            };

                            const res = await flip_user_status(user, "signUp");
                            if (res === 'success') {
                                feedbackMessage.textContent = 'Sign up successful. Redirecting to login...';
                                setTimeout(() => {
                                    location.reload();
                                }, 1000);
                            } else {
                                feedbackMessage.textContent = 'Sign up failed. Please check your input and try again.';
                                document.getElementById('signup-email').style.borderColor = 'red';
                                document.getElementById('signup-password').style.borderColor = 'red';
                            }
                        } else {
                            feedbackMessage.textContent = 'Verification failed. Please try again.';
                        }
                    });
                } catch (error) {
                    console.error('Error during sign up:', error);
                    feedbackMessage.textContent = 'An error occurred during sign up.';
                }
            });
        }

        if (loginButton && loginForm) {
            loginButton.addEventListener('click', () => {
                loginForm.style.display = 'block';
                signUpForm.style.display = 'none';
            });

            const loginFormElement = document.getElementById('loginForm');
            loginFormElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                const LogEmail = document.getElementById('login-email').value;
                const LogPassword = document.getElementById('login-password').value;
                const user = { email: LogEmail, password: LogPassword };

                const res = await flip_user_status(user, "login");
                if (res === 'success') {
                    feedbackMessage.textContent = 'User logged in successfully.';
                    location.reload();
                } else {
                    feedbackMessage.textContent = 'Login failed. Please check your email and password.';
                }
            });
        }
    });
});
