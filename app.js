import mysql from 'mysql2';

const conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    database: "user_accounts",
    password: "lexamed112233"
});

conn.connect(err => {
    if (err) {
        console.log(err);
        return err;
    } else {
        console.log('Database ----- OK');
    }
});
