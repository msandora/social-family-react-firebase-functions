const { db } = require("../util/admin");

exports.getFamily = (req, res) => {
  db.collection("family")
    .get()
    .then((data) => {
      let family = [];
      data.forEach((doc) => {
        family.push({
          postId: doc.id,
          id: doc.data().id,
          gender: doc.data().gender,
          firstName: doc.data().firstName,
          maidenName: doc.data().maidenName,
          lastName: doc.data().lastName,
          suffix: doc.data().suffix,
          dateOfBirth: doc.data().dateOfBirth,
          dateOfDeath: doc.data().dateOfDeath,
          bio: doc.data().bio,
          parents: doc.data().parents,
          children: doc.data().children,
          siblings: doc.data().siblings,
          spouses: doc.data().spouses
        });
      });
      // console.log("getFamily", family);
      return res.json(family);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
