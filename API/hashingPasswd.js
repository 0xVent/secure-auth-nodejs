import bcrypt from "bcrypt"

export async function hashPassword(password) {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
}

export async function checkPassword(password, hash) {
    const match = await bcrypt.compare(password, hash);
    
    if (match) {
        return true;
    }

    else {
        return false;
    }
}