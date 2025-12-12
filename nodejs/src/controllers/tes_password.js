const bcrypt = require("bcrypt");

const password = "Admin#123-";
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Hashed password to put in DB:", hash);
});