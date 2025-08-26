import { Database } from "./db.js"
import { checkIsValid, newSecretKey } from "./totp.js"
import { hashPassword, checkPassword } from "./hashingPasswd.js"

import express from 'express';
import cors from 'cors';
import { use } from "react";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const pendingLogin = {};

function isAlphanumeric(str) {
    return /^[a-zA-Z0-9]+$/.test(str);
}

export function currentDateTime() {
    const now = new Date();

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    let _count = new Database("users", ["username"], [username]);
    let __count = await _count.count();

    if(__count >= 1) {
        let DB = new Database("users", ["username"], [username]);
        let values = await DB.read();

        let checkPswd = await checkPassword(password, values[0].password);

        if (checkPswd) {
            // Correct credentials
            let rndID = Math.floor(Math.random() * 9999999999);

            const now = new Date();
            const expire = new Date(now.getTime() + 5 * 60 * 1000);

            while(true) {
                if(Array.isArray(pendingLogin[rndID])) {
                    rndID = Math.floor(Math.random() * 9999999999);
                }
                else {
                    break;
                }
            }

            pendingLogin[rndID] = pendingLogin[rndID] || [];

            pendingLogin[rndID].push({ 
                USERNAME: username, 
                TOTP_SECRET_KEY: values[0].totp_secret_key,
                EXPIRE: expire,
                ATTEMPTS: 0
            });
            
            const data = {
                "STATUS": "SUCCESS",
                "MESSAGE": "ACCEPTED - VALID CREDENTIALS, NOW YOU MUST VALIDATE YOUR ACCESS WITH THE OTP",
                "PENDING_ID": rndID,
                "EXPIRATION": expire,
                "STATUS_CODE": 202
            };

            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        }

        else {
            const data = {
                "STATUS": "ERROR",
                "MESSAGE": "UNAUTHORIZED - THE CREDENTIALS YOU ENTERED ARE INVALID",
                "STATUS_CODE": 401
            };

            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        }
    }

    else {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "UNAUTHORIZED - THE CREDENTIALS YOU ENTERED ARE INVALID",
            "STATUS_CODE": 401
        };

        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
});


app.post('/api/otp_verification', async (req, res) => {
    const { otp, pendingID } = req.body;

    let username = pendingLogin[pendingID][0].USERNAME;
    let totp_secretKey = pendingLogin[pendingID][0].TOTP_SECRET_KEY;
    let expire = pendingLogin[pendingID][0].EXPIRE;
    let attemps = pendingLogin[pendingID][0].ATTEMPTS;

    let _expire = new Date(expire);
    let now = new Date();
    
    if(now > _expire) {
        // The pending request has expired
        delete pendingLogin[pendingID];

        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "REQUEST TIMEOUT - THE REQUEST HAS EXPIRED",
            "STATUS_CODE": 408
        };

        res.writeHead(408, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    else {
        let otpIsValid = checkIsValid(otp, totp_secretKey);
        
        if(otpIsValid) {
            // Done, the user is authenticated! :)
            // You can now implement token management for user logins, including expiration control, multiple login management, and other related features

            delete pendingLogin[pendingID];

            const data = {
                "STATUS": "SUCCESS",
                "MESSAGE": "OK - USER AUTHORIZED",
                "LOGIN_TOKEN": "XXXX-XXXX-XXXX-XXXX",
                "SESSION_EXPIRY": "XX/XX/XX XX:XX:XX",
                "USERNAME": username,
                "STATUS_CODE": 200
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));

            console.log("[" + currentDateTime() + "] [OK] NEW AUTHORIZED LOGIN, USER: " + username);
        }

        else {
            pendingLogin[pendingID][0].ATTEMPTS = attemps + 1;

            // Incorrect OTP entered 5 times in a row, i'm canceling the request for security reasons
            if(attemps >= 5) {
                delete pendingLogin[pendingID];

                const data = {
                    "STATUS": "ERROR",
                    "MESSAGE": "TOO MANY REQUESTS - LOGIN REQUEST CANCELLED, YOU HAVE ENTERED TOO MANY INCORRECT OTP",
                    "STATUS_CODE": 429
                };

                res.writeHead(429, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            }

            else {
                const data = {
                    "STATUS": "ERROR",
                    "MESSAGE": "UNAUTHORIZED - WRONG OTP",
                    "STATUS_CODE": 401
                };

                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            }
        }
    }
});


app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;

    // Check if the username is an alphanumeric string
    if (isAlphanumeric(username) == false) {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "BAD REQUEST - THE USERNAME CAN ONLY CONTAIN NUMBERS AND LETTERS",
            "STATUS_CODE": 400
        };

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

        return;
    }

    // Check if the username contains at least 5 characters
    if (username.length < 5) {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "BAD REQUEST - THE USERNAME HAS LESS THAN 5 CHARACTERS",
            "STATUS_CODE": 400
        };

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

        return;
    }

    // Check if the username is more than 20 characters
    if (username.length > 20) {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "BAD REQUEST - THE USERNAME HAS MORE THAN 20 CHARACTERS",
            "STATUS_CODE": 400
        };

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

        return;
    }

    // Check if the password contains at least 6 characters
    if (password.length < 6) {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "BAD REQUEST - THE PASSWORD HAS LESS THAN 6 CHARACTERS",
            "STATUS_CODE": 400
        };

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

        return;
    }

    // Check if the password is more than 80 characters
    if (password.length > 80) {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "BAD REQUEST - THE PASSWORD HAS MORE THAN 80 CHARACTERS",
            "STATUS_CODE": 400
        };

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

        return;
    }

    // Check if the username already exists in the database
    let _count = new Database("users", ["username"], [username]);
    let __count = await _count.count();

    if (__count >= 1) {
        const data = {
            "STATUS": "ERROR",
            "MESSAGE": "CONFLICT - USERNAME IS ALREADY REGISTERED",
            "STATUS_CODE": 409
        };

        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

        return;
    }
    
    const cryptedPasswd = await hashPassword(password);

    let _newSecretKey = newSecretKey();
    
    const columns = ["username", "password", "totp_secret_key"];
    const parameters = [username, cryptedPasswd, _newSecretKey];
    
    let mysqlCMD = new Database("users", columns, parameters);
    mysqlCMD.insert();

    const data = {
        "STATUS": "SUCCESS",
        "TOTP_SECRET_KEY": _newSecretKey,
        "STATUS_CODE": 201
    };

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
});


app.listen(PORT, () => {
    console.log("[" + currentDateTime() + "] [OK] SERVER RUNNING: 127.0.0.1:" + PORT);
});