const functions = require("firebase-functions");
const app = require("express")();
const FBAuth = require("./util/FBAuth");

const cors = require("cors");
app.use(cors());

const { admin, db } = require("./util/admin");
const config = require("./util/config");

const { getMediaFileName } = require("./util/helpers");

const {
  getAllRecipes,
  postOneRecipe,
  // postNewRecipe,
  getRecipe,
  commentOnRecipe,
  likeRecipe,
  unlikeRecipe,
  deleteRecipe,
} = require("./handlers/recipes");

const {
  getAllScreams,
  postOneScream,
  // postNewScream,
  getScream,
  commentOnScream,
  likeScream,
  unlikeScream,
  deleteScream,
  uploadScreamMedia,
  deleteScreamMedia,
} = require("./handlers/screams");

const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead,
} = require("./handlers/users");

const { getFamily } = require("./handlers/family");

// Family routes
app.get("/family-tree", getFamily);

// recipe routes
app.get("/recipes", getAllRecipes);
app.post("/recipe", FBAuth, postOneRecipe);
// app.post("/recipe", FBAuth, postNewRecipe);
app.get("/recipe/:postId", getRecipe);
app.delete("/recipe/:postId", FBAuth, deleteRecipe);
app.get("/recipe/:postId/like", FBAuth, likeRecipe);
app.get("/recipe/:postId/unlike", FBAuth, unlikeRecipe);
app.post("/recipe/:postId/comment", FBAuth, commentOnRecipe);

// scream routes
app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, postOneScream);
// app.post("/scream", FBAuth, postNewScream);
app.get("/scream/:postId", getScream);
app.delete("/scream/:postId", FBAuth, deleteScream);
app.get("/scream/:postId/like", FBAuth, likeScream);
app.get("/scream/:postId/unlike", FBAuth, unlikeScream);
app.post("/scream/:postId/comment", FBAuth, commentOnScream);
app.post("/scream/:screamId/media", FBAuth, uploadScreamMedia);
app.delete("/scream/:screamId/media/:mediaId", FBAuth, deleteScreamMedia);

// users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

// https://baseurl.com/api/ - Make 'app' container for all routes
exports.api = functions.https.onRequest(app);

exports.createNotificationOnScreamLike = functions.firestore
  .document("likes/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            postId: doc.id,
          });
        }
      })
      .catch((err) => console.error(err));
  });

exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnScreamComment = functions.firestore
  .document("comments/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        /** need to check that the liked scream actually exists
         * and a sender is not a recepient, i.e. the user is not liking his own screams.
         * In that case, we do not send any notification.
         */
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            postId: doc.id,
          });
        }
      })
      .then(() => {
        return;
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onScreamDelete = functions.firestore
  .document("/screams/{postId}")
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("postId", "==", postId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("postId", "==", postId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("postId", "==", postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });

        return batch.commit();
      })
      .catch((err) => console.error(err));
  });

exports.onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate((change) => {
    console.log("before", change.before.data());
    console.log("after", change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("image has changed");
      const batch = db.batch();
      return db
        .collection("screams")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onRecipeDelete = functions.firestore
  .document("/recipes/{postId}")
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("postId", "==", postId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("postId", "==", postId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("postId", "==", postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });

// Might use these, not sure

// exports.createNotificationOnRecipeLike = functions
//   .firestore.document('likes/{id}')
//     .onCreate((snapshot) => {
//     return db
//       .doc(`/recipes/${snapshot.data().postId}`)
//       .get()
//       .then((doc) => {
//         if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
//           return db.doc(`/notifications/${snapshot.id}`).set({
//             createdAt: new Date().toISOString(),
//             recipient: doc.data().userHandle,
//             sender: snapshot.data().userHandle,
//             type: 'like',
//             read: false,
//             postId: doc.id
//           });
//         }
//       })
//       .catch((err) => console.error(err));
//   });

// exports.createNotificationOnRecipeComment = functions
//   .firestore.document('comments/{id}')
//   .onCreate((snapshot) => {
//     return db
//       .doc(`/recipes/${snapshot.data().postId}`)
//       .get()
//       .then((doc) => {
// /** need to check that the liked scream actually exists
//   * and a sender is not a recepient, i.e. the user is not liking his own screams.
//   * In that case, we do not send any notification.
//   */
//         if (
//           doc.exists &&
//           doc.data().userHandle !== snapshot.data().userHandle
//         ) {
//           return db.doc(`/notifications/${snapshot.id}`).set({
//             createdAt: new Date().toISOString(),
//             recipient: doc.data().userHandle,
//             sender: snapshot.data().userHandle,
//             type: 'comment',
//             read: false,
//             postId: doc.id
//           });
//         }
//       })
//       .then(() => {
//         return;
//       })
//       .catch((err) => {
//         console.error(err);
//         return;
//       });
//   });
