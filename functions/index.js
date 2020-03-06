const functions = require("firebase-functions");
const app = require('express')();
const FBAuth = require('./util/FBAuth');

const cors = require('cors');
app.use(cors());

const { db } = require('./util/admin');

const { 
  getAllRecipes,
  postOneRecipe,
  getRecipe,
  commentOnRecipe,
  likeRecipe,
  unlikeRecipe,
  deleteRecipe,
  uploadRecipeImage
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
app.get('/recipe/:screamId', getRecipe);
app.delete('/recipe/:screamId', FBAuth, deleteRecipe);
app.get('/recipe/:screamId/like', FBAuth, likeRecipe);
app.get('/recipe/:screamId/unlike', FBAuth, unlikeRecipe);
app.post('/recipe/:screamId/comment', FBAuth, commentOnRecipe);
//experiment
app.post('/recipe/image', FBAuth, uploadRecipeImage);


// scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, postOneScream);
app.get('/scream/:screamId', getScream);
app.delete('/scream/:screamId', FBAuth, deleteScream);
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);

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
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            screamId: doc.id
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
      .doc(`/screams/${snapshot.data().screamId}`)
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
            screamId: doc.id
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
    console.log("before", change.before.data());
    console.log("after", change.after.data());
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
  .firestore.document('/screams/{screamId}')
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('screamId', '==', screamId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('screamId', '==', screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('screamId', '==', screamId)
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




// // Experimenting down here > 

//   // [START import]
// const gcs = require('@google-cloud/storage')();
// const spawn = require('child-process-promise').spawn;
// const path = require('path');
// const os = require('os');
// const fs = require('fs');
// // [END import]

// // [START generateThumbnail]
// /**
//  * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
//  * ImageMagick.
//  */
// // [START generateThumbnailTrigger]
// exports.generateThumbnail = functions.storage
// .object()
// .onFinalize((object) => {
// // [END generateThumbnailTrigger]
//   // [START eventAttributes]
//   const fileBucket = object.bucket; // The Storage bucket that contains the file.
//   const filePath = object.name; // File path in the bucket.
//   const contentType = object.contentType; // File content type.
//   const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
//   // [END eventAttributes]

//   // [START stopConditions]
//   // Exit if this is triggered on a file that is not an image.
//   if (!contentType.startsWith('image/')) {
//     console.log('This is not an image.');
//     return null;
//   }

//   // Get the file name.
//   const fileName = path.basename(filePath);
//   // Exit if the image is already a thumbnail.
//   if (fileName.startsWith('thumb_')) {
//     console.log('Already a Thumbnail.');
//     return null;
//   }
//   // [END stopConditions]

//   // [START thumbnailGeneration]
//   // Download file from bucket.
//   const bucket = gcs.bucket(fileBucket);
//   const tempFilePath = path.join(os.tmpdir(), fileName);
//   const metadata = {
//     contentType: contentType,
//   };
//   return bucket.file(filePath).download({
//     destination: tempFilePath,
//   }).then(() => {
//     console.log('Image downloaded locally to', tempFilePath);
//     // Generate a thumbnail using ImageMagick.
//     return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]);
//   }).then(() => {
//     console.log('Thumbnail created at', tempFilePath);
//     // We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.
//     const thumbFileName = `thumb_${fileName}`;
//     // const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
//     const thumbFilePath = `thumbnail/${thumbFileName}`

//     // Uploading the thumbnail.
//     return bucket.upload(tempFilePath, {
//       destination: thumbFilePath,
//       metadata: metadata,
//     });

//     // Once the thumbnail has been uploaded delete the local file to free up disk space.
//   }).then(() => fs.unlinkSync(tempFilePath));
//   // [END thumbnailGeneration]
// });
// // [END generateThumbnail]