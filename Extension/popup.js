import { getById, registerUser, loginUser, update, addFavorite, removeFavorite, getAllFavorites, populateWebsiteTable, sendVerificationCode } from './db.js';

// create function that gets a user data, status and password if needed
// depending on the status the function will operate some of the crud functions from db.js
async function flip_user_status(user, status , deletePassword) {
    try {
        switch (status) {
            // if status is sign up it will register the given user and return a success message
            case 'signUp':
                await registerUser(user);
                return 'success';
            
            // in log in it will wait for response after using login function and store the response (token, user, websites) in a local storage
            // return a success message
            case 'login':
                const { token , user: loggedInUser} = await loginUser(user);
                const { websites } = await populateWebsiteTable();
                const fav = await getAllFavorites(loggedInUser.email);
                await new Promise((resolve, reject) => {
                    chrome.storage.local.set({ AuthToken: token, Websites : websites,  User: loggedInUser ,  Favorites: fav }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Error setting data:', chrome.runtime.lastError);
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve();
                        }
                    });
                });
                return 'success';
            
            case 'update':
            const res = await chrome.storage.local.get(['User']);

            if (res && res.User) {
                res.User = user;
                await update(res.User);
                await chrome.storage.local.set({ User: res.User });
                return 'success';
            } else {
                return 'fail';
            }
            // check if user email is included then wait for success message from delete function then delete the local stored data as well
            case 'removeFavorite':
                try {
                    // Add the favorite website to the data source
                    await removeFavorite(user);
                    // Retrieve all favorite websites
                    const results2 = await getAllFavorites(user.email);
                    // Store the updated list of favorites in Chrome's local storage
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ Favorites: results2 }, () => {
                            if (chrome.runtime.lastError) {
                                // Log results for debugging and handle errors
                                console.error('Error setting data:', chrome.runtime.lastError);
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve();
                            }
                        });
                    });
                    return 'success';
                } catch (error) {
                    // Log the error and return 'fail' if any issues occur
                    console.error('Error in AddFavorite case:', error.message || error);
                    return 'fail';
                }
                
            // check if user email is included then wait for success message from delete function then delete the local stored data as well
            case 'AddFavorite':
                try {
                    // Add the favorite website to the data source
                    await addFavorite(user);
                    // Retrieve all favorite websites
                    const results2 = await getAllFavorites(user.email);
                    // Store the updated list of favorites in Chrome's local storage
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ Favorites: results2 }, () => {
                            if (chrome.runtime.lastError) {
                                // Log results for debugging and handle errors
                                console.error('Error setting data:', chrome.runtime.lastError);
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve();
                            }
                        });
                    });
                    return 'success';
                } catch (error) {
                    // Log the error and return 'fail' if any issues occur
                    console.error('Error in AddFavorite case:', error.message || error);
                    return 'fail';
                }
                
            // delete the local stored data
            case 'logout':
                await chrome.storage.local.remove(['AuthToken', 'Websites', 'User', 'Status', 'Favorites']);
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
    // function to retrieve current Url to add to favorites
    function getCurrentUrl() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    const tab = tabs[0];
                    const currentUrl = new URL(tab.url);
                    resolve(currentUrl);
                } else {
                    reject('No active tab found');
                }
            });
        });
    }

    // function to validate password
    function validatePassword(password) {
        // Regular expression to check if the password is at least 8 characters long and contains at least one number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        return passwordRegex.test(password);
    }

    // get local stored data and display the 3 first websites if it is in the storage
    chrome.storage.local.get(['AuthToken', 'Websites', 'User', 'Status', 'Favorites'], async (result) => {
        try {
            let Url = await getCurrentUrl();
            let CurrentUrl = Url.href;

            // Display current URL
            // document.getElementById('url-display').textContent = `Current Page: ${CurrentUrl.hostname}`;

            // get element by id from document (popup.js)
            const formContainer = document.getElementById('form-container');
            const authToken = result.AuthToken;
            let websites = result.Websites || [];
            const topWebsites = websites.slice(0, 3);
            let Status = result.Status;
            let Favorites = result.Favorites || [];
            let Favorite = Favorites.some(favorite => favorite.url === CurrentUrl);

        // create html forms for if user is logged in and if user is not logged in

            const formHTML = 
            `<form id="form">
                <button id="signUp" type="button"> Register | 
                    <img id="signUp" type="button" src="icons/sign-up.png" alt="Sign up icon" class="icon">
                </button>
                <button id="Login" type="button"> Log in | 
                    <img id="Login" type="button" src="icons/login.png" alt="Login icon" class="icon">
                </button>
                <div id="feedback-message"></div>
            </form>`;

            // if the fetched authentication token from local storage exist
            if (authToken) {
                const logoutHTML = 
                `<form id="Logout">
                    <div class="header">
                        <button id="logout-button" class="logout-button"><img id="logout-button" src="icons/logout.png" alt="logout icon" class="icon"></button>
                        <h2>Mr/Mrs</h2>
                        <button id="account-button"><img id="account-button" src="icons/account.png" alt="account icon" class="icon"></button>
                    </div>
                    <div class="input-container">
                        <input class="inputName" type="text" id="firstName" value="${result.User.firstName}" placeholder="First Name">
                        <input class="inputName" type="text" id="lastName" value="${result.User.lastName}" placeholder="Last Name">
                        <button id="save-changes-button"><img id="save-changes-button" src="icons/refresh.png" class="icon" alt="refresh changes" ></button>
                    </div>
                        <h2 class="h2">Top 3 Websites</h2>
                    <ul id="websites-list">
                        ${topWebsites.map(website => {
                            const url = new URL(website);
                            return `<li><a href="${website}" target="_blank" >${url.hostname}</a></li>`;
                        }).join('')}
                    </ul>
                    <h2 id="url-display"></h2>
                    ${Status ? 
                        `
                            <input id="dataDesc" type="${Favorite ? 'hidden' : 'text'}" placeholder="Enter description" value=""><button id="${Favorite ? 'unlike-button' : 'like-button' }">
                            <img id="${Favorite ? 'unlike-button' : 'like-button' }" src="${Favorite ? 'icons/liked.png' : 'icons/like.png'}" alt="Like icon" class="icon">
                        </button>` 
                    : ''}                
                    <div id="feedback-message"></div>
                </form>`;

                // set the logged in form as the innerHTML for the popup.html
                formContainer.innerHTML = logoutHTML;

                // add click listener for logged in form
                document.getElementById('Logout').addEventListener('click', (event) => {
                    const feedbackMessage = document.getElementById('feedback-message');
                    feedbackMessage.textContent = '';

                    // if target is logout button
                    if (event.target.id === 'logout-button') {
                        // call flip_user_status function
                        flip_user_status(null, 'logout', null)
                        .then(res => {
                            // if response is success reload page and the form shown will be the log in/ sign up because authentication token removed from local storage
                            if (res === 'success') {
                                feedbackMessage.textContent = 'User logged out successfully.';
                                formContainer.innerHTML = formHTML;
                                location.reload();
                            } else {
                                feedbackMessage.textContent = 'Logout failed. Please try again.';
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            feedbackMessage.textContent = 'An error occurred during logout.';
                        });
                    } 
                    // if target save changes button
                    else if (event.target.id === 'save-changes-button') {
                        // call flip_user_status function
                        const firstName = document.getElementById('firstName').value;
                        const lastName = document.getElementById('lastName').value;
                        const user = { ...result.User, firstName: firstName, lastName: lastName };
                        flip_user_status(user, 'update', null)
                        .then(res => {
                            // if response is success reload page
                            if (res === 'success') {
                                feedbackMessage.textContent = 'User Name updated successfully.';
                                location.reload();
                            } else {
                                feedbackMessage.textContent = 'User Name update failed. Please try again.';
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            feedbackMessage.textContent = 'An error occurred during logout.';
                        });
                    } 
                    // if target account button
                    else if (event.target.id === 'account-button') {

                        const profileURL = chrome.runtime.getURL('profile.html');
                        
                        // Open the profile.html file in a new tab
                        chrome.tabs.create({ url: profileURL });
                    } 
                    // if target like button
                    else if (event.target.id === 'like-button') {
                        const description = document.getElementById('dataDesc').value;
                        const data = { url: CurrentUrl, description: description, email: result.User.email };
                        flip_user_status(data, "AddFavorite", null)
                        .then(res => {
                            if (res === 'success') {
                                feedbackMessage.textContent = 'Product saved successfully.';
                                location.reload();
                            } else {
                                feedbackMessage.textContent = 'Product saving failed, try again.';
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            feedbackMessage.textContent = 'An error occurred while deleting the account.';
                        });
                    }
                    // if target unlike button
                    else if (event.target.id === 'unlike-button') {
                        // call flip_user_status function and send the current tab url to remove
                        const data = { url: CurrentUrl, email: result.User.email };
                        flip_user_status(data, "removeFavorite", null)
                        .then(res => {
                            // if response is success reload page
                            if (res === 'success') {
                                feedbackMessage.textContent = 'Product unsaved Successfully.';
                                location.reload();
                            } else {
                                feedbackMessage.textContent = 'Product unsaved failed, try again.';
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            feedbackMessage.textContent = 'An error occurred while deleting the account.';
                        });
                    }
                });
            }
            // if the fetched authentication token from local storage doesn't exist
            else {
                // set the log in/ sign up form as the innerHTML for the popup.html
                formContainer.innerHTML = formHTML;
                function toggleVisibility(icon, passwordField) {
                    const isPasswordVisible = passwordField.type === 'password';
                    passwordField.type = isPasswordVisible ? 'text' : 'password';
                    icon.src = isPasswordVisible ? 'icons/close.png' : 'icons/see.png';
                }

                // add listener when click
                document.getElementById('form').addEventListener('click', (event) => {
                    const feedbackMessage = document.getElementById('feedback-message');
                    feedbackMessage.textContent = '';

                    // if the clicked target is login display a login form
                    if (event.target.id === 'Login') {
                        const loginFormHTML = 
                            `
                            <button id="back-button"><img id="back-button" src="icons/back.png" alt="back icon" class="icon"></button>
                            <form id="login-form">
                                <h2>Log In To Use The Extension</h2>
                                <input type="email" name="email" id="email" placeholder="Email.." required>
                                <div class="password-wrapper">
                                    <input type="password" name="password" id="password" placeholder="Password.." required>
                                    <img src="icons/see.png" class="icon" id="toggle-password3" alt="toggle visibility">
                                </div>
                                <button type="submit">Log In</button>
                                <div id="login-feedback"></div>
                            </form>`;
                        formContainer.innerHTML = loginFormHTML;
                        const togglePassword3 = document.getElementById('toggle-password3');
                        const passwordInput3 = document.getElementById('password');
                        togglePassword3.addEventListener('click', () => {
                            toggleVisibility(togglePassword3, passwordInput3);
                        });

                        // add listener of click if it's back it will reload the pop-up and go back to log in/ sign up form
                        document.getElementById('back-button').addEventListener('click', () => {
                            location.reload();
                        });

                        // if listener is submit for login form it will get the data submitted and call for the flip_user_status function
                        document.getElementById('login-form').addEventListener('submit', (e) => {
                            e.preventDefault();
                            const LogEmail = document.getElementById('email').value;
                            const LogPassword = document.getElementById('password').value;

                            const user = { email: LogEmail, password: LogPassword };

                            flip_user_status(user, "login", null)
                            .then(res => {
                                const feedback = document.getElementById('login-feedback');
                                // if response from function is success it will reload the html page and show a form of logged in user because the function has successfully stored the authentication and user data
                                if (res === 'success') {
                                    feedback.textContent = 'User logged in successfully.';
                                    location.reload();
                                } else {
                                    // else it will show message error
                                    feedback.textContent = 'Login failed. Please check your email and password.';
                                    document.getElementById('email').style.borderColor = 'red';
                                    document.getElementById('password').style.borderColor = 'red';
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                feedback.textContent = 'An error occurred during login.';
                            });
                        });
                    } 
                    // if the clicked target is sign up display a sign up form
                    else if (event.target.id === 'signUp') {
                        const signUpFormHTML = `
                            <button id="back-button"><img src="icons/back.png" alt="back icon" class="icon"></button>
                            <form id="signUp-form">
                                <h2>Sign up To Use The Extension</h2>
                                <input type="text" name="firstName" id="firstName" placeholder="First Name.." required>
                                <input type="text" name="lastName" id="lastName" placeholder="Last Name.." required>
                                <input type="email" name="email" id="email" placeholder="Email.." required>
                                <div class="password-wrapper">
                                    <input type="password" name="password" id="password" placeholder="Password.." required>
                                    <img src="icons/see.png" class="icon" id="toggle-password" alt="toggle visibility">
                                </div>
                                <div class="password-wrapper">
                                    <input type="password" name="password2" id="password2" placeholder="Confirm password.." required>
                                    <img src="icons/see.png" class="icon" id="toggle-password2" alt="toggle visibility">
                                </div>
                                <button type="submit">Sign Up</button>
                                <div id="signup-feedback"></div>
                            </form>`;
                        
                        const verifyEmail = `
                            <div id="verify-email-form" class="form" style="display: block;"> <!-- Ensure display: block -->
                                <h2>Email Verification</h2>
                                <form id="emailVerify">
                                    <label for="code">Enter Your Verification Code:</label>
                                    <input type="text" id="code" name="code" placeholder="Verification code..." required>
                                    <button id="verify-button" type="button">Verify Code</button>
                                </form>
                            </div>`;
                        
                        // Inject sign-up form HTML
                        formContainer.innerHTML = signUpFormHTML;
                    
                        const togglePassword = document.getElementById('toggle-password');
                        const passwordInput = document.getElementById('password');

                        const togglePassword2 = document.getElementById('toggle-password2');
                        const passwordInput2 = document.getElementById('password2');
                        togglePassword.addEventListener('click', () => {
                            toggleVisibility(togglePassword, passwordInput);
                        });

                        togglePassword2.addEventListener('click', () => {
                            toggleVisibility(togglePassword2, passwordInput2);
                        });
                        // Add listener for the back button
                        document.getElementById('back-button').addEventListener('click', () => {
                            // Optionally navigate back to the login/sign up page
                            location.reload(); // If you want to reload the entire page
                        });
                    
                        // Add listener for submitting the sign-up form
                        document.getElementById('signUp-form').addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const SignUpFirstName = document.getElementById('firstName').value;
                            const SignUpLastName = document.getElementById('lastName').value;
                            const SignUpEmail = document.getElementById('email').value;
                            const SignUpPassword = document.getElementById('password').value;
                            const SignUpPassword2 = document.getElementById('password2').value;
                            const feedback = document.getElementById('signup-feedback');
                    
                            if (SignUpPassword !== SignUpPassword2) {
                                feedback.textContent = 'Passwords do not match. Please try again.';
                                return; // Stop form submission
                            }
                    
                            if (!validatePassword(SignUpPassword)) {
                                feedback.textContent = 'Password must be at least 8 characters long and contain at least one number.';
                                return; // Stop form submission
                            }
                    
                            try {
                                if(await getById(SignUpEmail)) 
                                    feedback.textContent = 'Email already in use. Please try again.';
                                else {
                                    feedback.textContent = '';
                                    // Step 1: Send Verification Code
                                    const verificationCode = String(await sendVerificationCode(SignUpEmail));
                        
                                    // Update form container with verification form
                                    formContainer.innerHTML = verifyEmail;
                        
                                    // Set up event listener for verification button
                                    document.getElementById('verify-button').addEventListener('click', async () => {
                                        const userCodeInput = document.getElementById('code').value.trim();
                        
                                        if (userCodeInput === verificationCode) {
                                            const user = {
                                                email: SignUpEmail,
                                                firstName: SignUpFirstName,
                                                lastName: SignUpLastName,
                                                password: SignUpPassword
                                            };
                                            const res = await flip_user_status(user, "signUp");
                                            if (res === 'success') {
                                                feedback.textContent = 'Sign up successful. Redirecting to login...';
                                                setTimeout(() => {
                                                    location.reload(); // Reload the page or redirect as needed
                                                }, 1000);
                                            } else {
                                                feedback.textContent = 'Sign up failed. Please check your input and try again.';
                                            }
                                        } else {
                                            feedback.textContent = 'Verification failed. Please try again.';
                                        }
                                    });
                                }
                            } catch (error) {
                                console.error('Error during sign up:', error);
                                feedback.textContent = 'An error occurred during sign up.';
                            }
                        });
                    }
                    
                });
            }
        } catch (error) {
            console.error(error);
            const feedbackMessage = document.getElementById('feedback-message');
            feedbackMessage.textContent = 'An error occurred while retrieving the current URL.';
        }
    });
});

document.getElementById('extension-status').addEventListener('click', () => {
    const profileURL = chrome.runtime.getURL('log.html');
    // Open the profile.html file in a new tab
    chrome.tabs.create({ url: profileURL });
});