import { authenticator } from 'otplib';

export function newSecretKey() {
    const secret = authenticator.generateSecret();
    return secret;
}

export function checkIsValid(input_key, secret_key) {
    const isValid = authenticator.check(input_key, secret_key);

    if (isValid) {
        return true;
    }

    else {
        return false;
    }
}