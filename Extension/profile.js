import { update, deleteData, addFavorite, removeFavorite, getAllFavorites, refresh, confirmPassword  } from './db.js';

// create function that gets a user data, status and password if needed
// depending on the status the function will operate some of the crud functions from db.js
async function flip_user_status(user, status , deletePassword) {
    try {
        switch (status) {
            // get the user from local storage and update the password in storage to send it in the next function
            // update password in database and wait for new user data then update it in storage again
            case 'password':
                const result = await chrome.storage.local.get(['User']);

                if (result && result.User) {
                    result.User = user;
                    await update(result.User);
                    await chrome.storage.local.set({ User: result.User });
                    return 'success';
                } else {
                    return 'fail';
                }
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
            case 'delete':
                if (!user.email) {
                    throw new Error('User email is required for deletion.');
                }
                await deleteData(user.email, deletePassword);
                await chrome.storage.local.remove(['AuthToken', 'Websites', 'User', 'Status', 'Favorites']);
                return 'success';
                
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
                
            // refresh website table
            case 'refresh':
                try {
                    const { websites } = await refresh();
                    await new Promise((resolve, reject) => {
                        chrome.storage.local.set({ Websites: websites }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('Error setting data:', chrome.runtime.lastError);
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve();
                            }
                        });
                    });
                    return 'success';
                } catch (error) {
                    console.error('Error in refresh case:', error.message || error);
                    return 'fail';
                }

            case 'confirmPassword':
                try {
                    const userCredentials = { email: user.email, password: deletePassword };
                    const result = await confirmPassword(userCredentials);
                    return 'success';
                } catch (error) {
                    console.error('Error in confirmPassword case:', error.message || error);
                    return 'fail';
                }
                
            default:
                return 'fail';
        }
    } catch (error) {
        console.error('Error in flip_user_status:', error.message || error);
        return 'fail';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // function to validate password
    function validatePassword(password) {
        // Regular expression to check if the password is at least 8 characters long and contains at least one number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        return passwordRegex.test(password);
    }

    chrome.storage.local.get(['AuthToken', 'Websites', 'User', 'Status', 'Favorites'], async (result) => {

        if (!result.AuthToken) {
            // If there is no AuthToken, redirect to the login page
            const loginURL = chrome.runtime.getURL('log.html'); // Replace 'log.html' with your login page's URL
            window.location.href = loginURL;// Exit the function to prevent the rest of the code from executing
        }else if (result.AuthToken) {

            const navBar = document.getElementById('nav');
            const profileContainer = document.getElementById('content');
            const feedbackMessage = document.getElementById('feedback-message');
            const tbody = document.getElementById('tbody');
            const passwordChangeForm = document.getElementById('password-change-form');
            const updatePasswordButton = document.getElementById('update-password-button');
            const firstNameInput = document.getElementById('firstName');
            const lastNameInput = document.getElementById('lastName');
            firstNameInput.value = result.User.firstName;
            lastNameInput.value = result.User.lastName;

            const profileHTML = result.Favorites.map((website, index) => {
                const { url, description } = website;
                const displayUrl = new URL(url);
                return `
                    <tr>
                        <td><a href="${url}" target="_blank">${displayUrl.hostname}</a></td>
                        <td>${description || 'No description'}</td>
                        <td>
                            <button type="button" class="unlike-button" id="unlike-button">
                                <input type="hidden" name="index" value="${index}">
                                <input type="hidden" id="Url${index}" value="${url}">
                                <img id="unlike-button" src="icons/liked.png" alt="Unlike icon" class="icon">
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            if (tbody) {
                tbody.innerHTML = profileHTML;
            }
            
            if (updatePasswordButton) {
                updatePasswordButton.addEventListener('click', async () => {
                    const oldPassword = document.getElementById('oldPassword').value;
                    const newPassword = document.getElementById('newPassword').value;
                    const confirmPassword = document.getElementById('confirmPassword').value;
                    const rest = await flip_user_status(result.User, "confirmPassword", oldPassword);
                    if(rest !== 'success'){
                        alert(`Current Password not correct ! `);
                        return;
                    }else if (oldPassword === newPassword) {
                        alert("New password is the same as current one!.");
                        return;
                    }else if (newPassword !== confirmPassword) {
                        alert("New password and confirmation don't match.");
                        return;
                    }else if (!validatePassword(newPassword)) {
                        alert("New password must be at least 8 characters long and contain at least one number.");
                        return;
                    }
        
                    // Assuming `result.User` contains the current user data
                    const user = { ...result.User, password: newPassword };
                    const res = await flip_user_status(user, "password", null);
                    feedbackMessage.textContent = res === 'success' ? 'Password changed successfully.' : 'Password change failed. Please try again.';
                    if (res === 'success') {
                        passwordChangeForm.style.display = 'none';
                        location.reload();
                    }
                });
            }

            if (profileContainer) {
                profileContainer.addEventListener('click', async (event) => {
                    if (event.target.closest('.password-button')) {
                        if(passwordChangeForm.style.display === 'block')
                            passwordChangeForm.style.display = 'none';
                        else
                            passwordChangeForm.style.display = 'block';
                    }
                    else if (event.target.closest('.delete-button')) {
                        if (confirm("Are you sure you want to delete your account?")) {
                            const CheckPassword = prompt("Enter your password:");
                            const res = await flip_user_status(result.User, "delete", CheckPassword);
                            feedbackMessage.textContent = res === 'success' ? 'Account deleted successfully.' : 'Account deletion failed. Please try again.';
                            if (res === 'success') {
                                location.reload();
                            }                    
                        }
                    } else if (event.target.closest('.unlike-button')) {
                        const index = event.target.closest('button').querySelector('input[name="index"]').value;
                        const webUrl = document.getElementById(`Url${index}`).value;
                        const data = { url: webUrl, email: result.User.email };
                        const res = await flip_user_status(data, "removeFavorite", null);
                        feedbackMessage.textContent = res === 'success' ? 'Product unsaved Successfully.' : 'Product unsaved failed, try again.';
                        if (res === 'success') location.reload();
                    } else if (event.target.closest('.save-changes-button')) {
                        const firstName = document.getElementById('firstName').value;
                        const lastName = document.getElementById('lastName').value;
                        const user = { ...result.User, firstName: firstName, lastName: lastName };
                        const res = await flip_user_status(user, "update", null);
                        feedbackMessage.textContent = res === 'success' ? 'User Name updated successfully.' : 'UserName update failed. Please try again.';
                    } else if (event.target.closest('.refresh')) {
                        const res = await flip_user_status(null, "refresh", null);
                        feedbackMessage.textContent = res === 'success' ? 'Product refreshed Successfully.' : 'Product refreshing failed, try again.';
                    }
                });
            }

            if (navBar) {
                navBar.addEventListener('click', async (event) => {
                    if (event.target.closest('.logout-button')) {
                        try {
                            const res = await flip_user_status(null, 'logout', null);
                            feedbackMessage.textContent = res === 'success' ? 'User logged out successfully.' : 'Logout failed. Please try again.';
                            if (res === 'success') {
                                const profileURL = chrome.runtime.getURL('log.html');
                                chrome.tabs.create({ url: profileURL });
                            }
                        } catch (err) {
                            console.error(err);
                            feedbackMessage.textContent = 'An error occurred during logout.';
                        }
                    }
                });
            }
        }
    });
});
