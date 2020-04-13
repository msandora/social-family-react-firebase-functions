const functions = require('firebase-functions');
const app = require('express')();
const FBAuth = require('./util/FBAuth');

const cors = require('cors');
app.use(cors());

const { db } = require('./util/admin');

const { 
  getAllRecipes,
  postOneRecipe,
  deleteRecipe,
  getRecipe,
  likeRecipe,
  unlikeRecipe
} = require('./handlers/recipes');
const { 
  getAllScreams, 
  postOneScream, 
  getScream, 
  commentOnScream,
  likeScream,
  unlikeScream,
  deleteScream
} = require('./handlers/screams');
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
} = require('./handlers/users');

// recipe routes
app.get('/recipes', getAllRecipes);
app.post('/recipe', FBAuth, postOneRecipe);
app.get('/recipe/:postId', getRecipe);
app.delete('/recipe/:postId', FBAuth, deleteRecipe);
app.get('/recipe/:postId/like', FBAuth, likeRecipe);
app.get('/recipe/:postId/unlike', FBAuth, unlikeRecipe);

// scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, postOneScream);
app.get('/scream/:postId', getScream);
app.delete('/scream/:postId', FBAuth, deleteScream);
app.get('/scream/:postId/like', FBAuth, likeScream);
app.get('/scream/:postId/unlike', FBAuth, unlikeScream);
app.post('/scream/:postId/comment', FBAuth, commentOnScream);

// users routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

// https://baseurl.com/api/ - Make 'app' container for all routes
exports.api = functions.https.onRequest(app);


exports.createNotificationOnLike = functions
  .firestore.document('likes/{id}')
    .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            postId: doc.id
          });
        }
      })
      .catch((err) => console.error(err));
  });

exports.deleteNotificationOnUnLike = functions
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnComment = functions
  .firestore.document('comments/{id}')
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
            type: 'comment',
            read: false,
            postId: doc.id
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

exports.onUserImageChange = functions
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('screams')
        .where('userHandle', '==', change.before.data().handle)
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

exports.onScreamDelete = functions
  .firestore.document('/screams/{postId}')
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('postId', '==', postId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('postId', '==', postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('postId', '==', postId)
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
