// db.js

// new promise that opens the database needed
export const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('Extension', 2);
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // call for createObjectStore function to store tables
        createObjectStore(db, 'users', 'email');
        createObjectStore(db, 'favorites', 'id','email');
        createObjectStore(db, 'websites', 'url');
    };
    // return results on success
    request.onsuccess = (event) => {
        resolve(event.target.result);
    };
    // return error if any
    request.onerror = (event) => {
        reject(event.target.error);
    };
});

function createObjectStore(db, name, keyPath, indexName) {
    if (!db.objectStoreNames.contains(name)) {
        const options = { keyPath: keyPath, autoIncrement: keyPath === 'id' };
        const objectStore = db.createObjectStore(name, options);

        // Conditionally create an index if the object store is 'favorites'
        if (name === 'favorites' && indexName) {
            objectStore.createIndex(indexName, indexName, { unique: false });
        }
    }
}

async function getAllWebsites(websitesStore) {
    return new Promise((resolve, reject) => {
        // get all from a given object store of a specific transaction
        const getAllRequest = websitesStore.getAll();
        // return results or error if any
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
    });
}

export async function populateWebsiteTable() {
    // create new promise of database
    const db = await dbPromise;
    try {
        // set transaction and object store needed and retrieve all websites using the getAllWebsites function
        let transaction = db.transaction('websites', 'readwrite');
        let websitesStore = transaction.objectStore('websites');
        let allWebsites = await getAllWebsites(websitesStore);

        // fetch website from the hardcoded website list if the table is empty
        if (allWebsites.length === 0) {
            const response = await fetch('http://localhost:3000/websites');
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            // get the data json and create new transaction and object store
            const urls = await response.json();

            transaction = db.transaction('websites', 'readwrite');
            websitesStore = transaction.objectStore('websites');

            // add the data json into the table and return result or error if any
            const addPromises = urls
                .map(url => {
                    return new Promise((resolve, reject) => {
                        const addRequest = websitesStore.add({ url });
                        addRequest.onsuccess = () => resolve();
                        addRequest.onerror = (event) => reject(event.target.error);
                    });
                });

            // wait for all promises of addPromises
            await Promise.all(addPromises);

            // wait for promise of the transaction to be done
            await new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(event.target.error);
            });

            // create new transaction to retrieve the new set of data stored in the table and then return them after the conditions are completed
            transaction = db.transaction('websites', 'readonly');
            websitesStore = transaction.objectStore('websites');
            allWebsites = await getAllWebsites(websitesStore);
        }
        return { websites: allWebsites.map(site => site.url) };
    } catch (error) {
        console.error('Failed to populate website table:', error);
        throw error;
    }
}

export async function hashPassword(password) {
    // hash the given password and return the new password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function registerUser({ email, firstName, lastName, password }) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        // add transaction to retrieve any data from the table users that has the same key value
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(email);

        request.onsuccess = async () => {
            // if data found send a rejection because account already exist
            if (request.result) {
                return reject({ message: "Account with this email already exists!" });
            }

            // if not hash the password in the parameter and create a new transaction to store the user
            const hashedPassword = await hashPassword(password);

            const transaction = db.transaction('users', 'readwrite');
            const store = transaction.objectStore('users');
            const addRequest = store.add({ firstName, lastName, email, password: hashedPassword });

            // when transaction is completed return the user data
            addRequest.onsuccess = () => {
                resolve({ message: "Registered user successfully", user: { email, firstName, lastName } });
            };

            // return error if any while saving the user
            addRequest.onerror = () => {
                reject({ message: addRequest.error.message });
            };
        };

        // return error if any while looking for the user with the given email
        request.onerror = () => {
            reject({ message: request.error.message });
        };
    });
}

export async function sendVerificationCode(email) {
    try {
        
        const response = await fetch('http://localhost:3000/send-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const { verificationCode }= await response.json();

        // Extract the verification code from the response
        return verificationCode;
    } catch (error) {
        console.error('Error sending verification code:', error);
        throw new Error('Failed to send verification code');
    }
}

export async function loginUser({ email, password }) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        // create transaction to fetch a user with given email
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(email);

        request.onsuccess = async () => {
            // if user not found reject demand because no account registered with the given email
            const user = request.result;
            if (!user) {
                return reject({ message: "Account with this email doesn't exist!" });
            }

            // if user found hash given password and compare it with fetched user
            try {
                const hashedPassword = await hashPassword(password);
                if (hashedPassword !== user.password) {
                    return reject({ message: "Incorrect password!" });
                }

                // fetch the /login to create a token
                const response = await fetch('http://localhost:3000/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (!response.ok) {
                    const error = await response.json();
                    return reject({ message: error.message });
                }

                const { token } = await response.json();
                
                // return the user data and token when transaction succeeded
                resolve({ 
                    token, 
                    user: { 
                        email: user.email, 
                        firstName: user.firstName, 
                        lastName: user.lastName 
                    } 
                });
            } catch (error) {
                reject({ message: 'Failed to fetch token from backend: ' + error.message });
            }
        };

        // return error if any while fetching the user f=with the given email
        request.onerror = () => {
            reject({ message: request.error.message });
        };
    });
}

export async function confirmPassword({ email, password }) {
    // Validate that email and password are provided
    if (!email || !password) {
        return Promise.reject({ message: "Email and password must be provided." });
    }

    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        // Create a transaction to fetch the user with the given email
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        
        // Check if email is a valid key
        if (typeof email !== 'string' || email.trim() === '') {
            return reject({ message: "Invalid email provided." });
        }

        const request = store.get(email);

        request.onsuccess = async () => {
            const user = request.result;

            // Check if the user exists
            if (!user) {
                return reject({ message: "No account registered with the given email." });
            }

            try {
                // Hash the provided password and compare it with the stored hashed password
                const hashedPassword = await hashPassword(password);
                if (hashedPassword === user.password) {
                    return resolve({ message: "Success" });
                } else {
                    return reject({ message: "Incorrect password." });
                }
            } catch (error) {
                reject({ message: 'Error during password verification: ' + error.message });
            }
        };

        // Handle errors that occur during the transaction
        request.onerror = () => {
            reject({ message: 'Error fetching user: ' + request.error.message });
        };
    });
}

export async function getAllFavorites(userEmail) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        try {
            // Create a read-only transaction for the 'favorites' object store
            const transaction = db.transaction('favorites', 'readonly');
            const store = transaction.objectStore('favorites');
            const index = store.index('email'); // Use the index on 'email'

            // Query using the index to get favorites for the specified email
            const request = index.getAll(userEmail);

            request.onsuccess = () => {
                resolve(request.result);  // Return the list of favorites for the specified email
            };

            request.onerror = () => {
                reject({ message: request.error.message });
            };
        } catch (error) {
            console.error('Failed to retrieve favorite websites:', error);
            reject(error);
        }
    });
}

export async function addFavorite(data) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction('favorites', 'readwrite');
        const store = transaction.objectStore('favorites');
        const request = store.put(data);  // Use put instead of add to handle updates

        request.onsuccess = () => {
            resolve({ message: "Favorite added/updated successfully" });
        };

        request.onerror = () => {
            reject({ message: request.error.message });
        };
    });
}

export async function removeFavorite(user) {
    const db = await dbPromise;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction('favorites', 'readwrite');
        const store = transaction.objectStore('favorites');

        // Retrieve all favorites to filter by URL and email
        const index = store.index('email');
        const request = index.openCursor(IDBKeyRange.only(user.email));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.url === user.url) {
                    cursor.delete();
                    resolve({ message: "Favorite removed successfully" });
                } else {
                    cursor.continue();
                }
            } else {
                resolve({ message: "Favorite not found" });
            }
        };

        request.onerror = () => {
            reject({ message: request.error.message });
        };
    });
}

export async function getById(email) {
    const db = await dbPromise;
    // create transaction to fetch a user with the given email
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.get(email);

        // return result or error if any
        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

export async function getAll() {
    const db = await dbPromise;
    // create transaction to fetch all users
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const request = store.getAll();

        // return result or error if any
        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

export async function update(data) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        // Start a transaction to retrieve user data
        const retrieveTransaction = db.transaction('users', 'readonly');
        const retrieveStore = retrieveTransaction.objectStore('users');
        const retrieveRequest = retrieveStore.get(data.email);

        retrieveRequest.onsuccess = async () => {
            // Hash password if provided
            if (data.password) {
                data.password = await hashPassword(data.password);
            } else {
                // Keep existing password if none provided
                data.password = retrieveRequest.result.password;
            }
            const updatedUser = {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: data.password,
            };
            // Start a new transaction to update user data
            const updateTransaction = db.transaction('users', 'readwrite');
            const updateStore = updateTransaction.objectStore('users');
            const updateRequest = updateStore.put(updatedUser);

            // Return result or error
            updateRequest.onsuccess = () => {
                resolve(updateRequest.result);
            };

            updateRequest.onerror = () => {
                reject(updateRequest.error);
            };
        };

        retrieveRequest.onerror = () => {
            reject(retrieveRequest.error);
        };
    });
}

export async function deleteData(email, password) {
    const db = await dbPromise;
    // hash the given password
    password = await hashPassword(password);

    return new Promise((resolve, reject) => {
        // Start a transaction to fetch the user with the given email
        const transaction = db.transaction(['users', 'favorites'], 'readwrite');
        const userStore = transaction.objectStore('users');
        const favoriteStore = transaction.objectStore('favorites');
        const dataUser = userStore.get(email);

        dataUser.onsuccess = async () => {
            const user = dataUser.result;

            // If the user exists and the password matches, proceed to delete the user
            if (user && user.password === password) {
                const deleteUserRequest = userStore.delete(email);

                deleteUserRequest.onsuccess = async () => {
                    // Remove all favorites associated with the user's email
                    const index = favoriteStore.index('email');
                    const request = index.openCursor(IDBKeyRange.only(email));

                    const deleteRequests = [];
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            deleteRequests.push(cursor.delete());
                            cursor.continue(); // Continue to the next matching record
                        } else {
                            // All matching records have been processed
                            Promise.all(deleteRequests)
                                .then(() => resolve({ message: "User and all associated favorites removed successfully" }))
                                .catch(err => reject({ message: err.message }));
                        }
                    };

                    request.onerror = () => {
                        reject({ message: request.error.message });
                    };
                };

                deleteUserRequest.onerror = () => {
                    reject(deleteUserRequest.error);
                };
            } else {
                reject(new Error('Invalid email or password'));
            }
        };

        dataUser.onerror = () => {
            reject(dataUser.error);
        };
    });
}

export async function refresh() {
    const db = await dbPromise;

    return new Promise(async (resolve, reject) => {
        try {
            // Start a transaction to clear the 'websites' object store
            const transaction = db.transaction('websites', 'readwrite');
            const store = transaction.objectStore('websites');
            const clearRequest = store.clear();

            clearRequest.onsuccess = async () => {
                try {
                    await new Promise((resolve, reject) => {
                        transaction.oncomplete = () => resolve();
                        transaction.onerror = (event) => reject(event.target.error);
                    });
                    // After clearing the websites, populate it again
                    const result = await populateWebsiteTable();
                    resolve(result); // Resolve with the result of populateWebsiteTable
                } catch (error) {
                    // Handle errors that occur during re-population
                    reject({ message: error.message });
                }
            };

            clearRequest.onerror = (event) => {
                // Handle errors that occur during clearing the object store
                reject({ message: event.target.error.message });
            };
        } catch (error) {
            reject({ message: error.message });
        }
    });
}
