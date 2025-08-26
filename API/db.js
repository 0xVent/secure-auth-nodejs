import mysql from 'mysql';
import { currentDateTime } from "./server.js"

const pool = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "testdb",
    connectionLimit: 10
});

console.log("[" + currentDateTime() + "] [OK] MYSQL POOL CREATED SUCCESSFULLY");

export class Database {
    constructor(table, columns, parameters) {
        this.table = table;
        this.columns = "";
        this.Rcolumns = "";
        this.parameters = parameters;
        this._P = "";

        for(let i = 0; i < columns.length; i++) {
            this.columns += columns[i];
            if (i < columns.length - 1) {
                this.columns += ", ";
            }
        }

        for(let i = 0; i < columns.length; i++) {
            this.Rcolumns += columns[i] + " = ?";
            if (i < columns.length - 1) {
                this.Rcolumns += " AND ";
            }
        }

        for(let i = 0; i < parameters.length; i++) {
            this._P += "?";
            if (i < columns.length - 1) {
                this._P += ", ";
            }
        }
    }

    insert() {
        pool.query("INSERT INTO " + this.table + " (" + this.columns + ") VALUES (" + this._P + ")", this.parameters, function(err, results) {
            if (err) throw err;
        });
    }

    read() {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM " + this.table + " WHERE " + this.Rcolumns, this.parameters, function(err, results) {
                if (err) throw err;
                resolve(results);
            });
        });
    }

    count() {
        return new Promise((resolve, reject) => {
            pool.query("SELECT COUNT(*) AS count FROM " + this.table + " WHERE " + this.columns + " = " + this._P, this.parameters, function(err, results) {
                if (err) throw err;
                resolve(results[0].count);
            });
        });
    }
}