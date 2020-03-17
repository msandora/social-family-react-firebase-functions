const { admin, db } = require('../util/admin');
const config = require('../util/config');

const {
  validateRecipeData
} = require('../util/validators');

/*********************** 
// Fetch all recipe
Get: /api/recipes
No Headers / No Body
************************/
exports.getAllRecipes = (req, res) => {
  db.collection('recipes')
    .orderBy('createdAt', 'desc')
    .get()
    .then((data) => {
      let recipes = [];
      data.forEach((doc) => {
        recipes.push({
            screamId: doc.id,
            recipeTitle: doc.data().recipeTitle,
            recipeType: doc.data().recipeType,
            body: doc.data().body,
            ingredients: doc.data().ingredients,
            userHandle: doc.data().userHandle,
            userImage: doc.data().userImage,
            createdAt: doc.data().createdAt,
            likeCount: doc.data().likeCount,
            commentCount: doc.data().commentCount
        });
      });
      console.log("getAllRecipes", recipes);
      return res.json(recipes);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.postOneRecipe = (req, res) => {
	const newRecipe = {
		recipeTitle: req.body.recipeTitle,
		recipeType: req.body.recipeType,
		body: req.body.body,
		ingredients: req.body.ingredients,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };
  console.log("postOneRecipe", newRecipe);

  const { valid, errors } = validateRecipeData(newRecipe);

  if (!valid) return res.status(400).json(errors);

	db.collection('recipes')
		.add(newRecipe)
		.then((doc) => {
			const resRecipe = newRecipe;
			resRecipe.screamId = doc.id;
			res.json(resRecipe);
		})
		.catch((err) => {
			res.status(500).json({ error: 'something went wrong' });
			console.error(err);
		});
};

/*********************** 
// Fetch one recipe
Get: /api/recipe/(screamId: MVz7Dhjkc3jjLHCFhpAV)
No Headers / No Body
************************/
exports.getRecipe = (req, res) => {
  let recipeData = {};
  db.doc(`/recipes/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      recipeData = doc.data();
      recipeData.screamId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')  // 2:42:00 need to create comments index in firebase
        .where('screamId', '==', req.params.screamId)
        .get();
    })
    .then((data) => {
      recipeData.comments = [];
      data.forEach((doc) => {
        recipeData.comments.push(doc.data());
      });
      return res.json(recipeData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// Comment on a Recipe
Post: /api/recipe/(ScreamId: MVz7Dhjkc3jjLHCFhpAV)/comment
Headers: Bearer (Authorization Token)
Body: {
	"body": "Comment on a Recipe"
}
************************/
exports.commentOnRecipe = (req, res) => {
  if (req.body.body.trim() === '')
    return res.status(400).json({ comment: 'Must not be empty' });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    screamId: req.params.screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };
  console.log(newComment);

  db.doc(`/recipes/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection('comments').add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: 'Something went wrong' });
    });
};

/*********************** 
// Like a recipe
Get: /api/recipe/MVz7Dhjkc3jjLHCFhpAV/like
Headers: Bearer (Authorization Token)
************************/
exports.likeRecipe = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('screamId', '==', req.params.screamId)
    .limit(1);

  const recipeDocument = db.doc(`/recipes/${req.params.screamId}`);

  let recipeData;

  recipeDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        recipeData = doc.data();
        recipeData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Recipe not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            screamId: req.params.screamId,
            userHandle: req.user.handle
          })
          .then(() => {
            recipeData.likeCount++;
            return recipeDocument.update({ likeCount: recipeData.likeCount });
          })
          .then(() => {
            return res.json(recipeData);
          });
      } else {
        return res.status(400).json({ error: 'Recipe already liked' });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// Unlike a recipe
Get: /api/recipe/MVz7Dhjkc3jjLHCFhpAV/unlike
Headers: Bearer (Authorization Token)
************************/
exports.unlikeRecipe = (req, res) => {
  const likeDocument = db
    .collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('screamId', '==', req.params.screamId)
    .limit(1);

  const recipeDocument = db.doc(`/recipes/${req.params.screamId}`);

  let recipeData;

  recipeDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        recipeData = doc.data();
        recipeData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Recipe not found' });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: 'Recipe not liked' });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            recipeData.likeCount--;
            return recipeDocument.update({ likeCount: recipeData.likeCount });
          })
          .then(() => {
            res.json(recipeData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// Delete a recipe
Delete: /api/recipe/0fgCErKMixJoGZt65WtV
Headers: Bearer (Authorization Token)
No body 
************************/
exports.deleteRecipe = (req, res) => {
  const document = db.doc(`/recipes/${req.params.screamId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: 'Unauthorized' });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: 'Recipe deleted successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};


// Experimenting
// I am trying to create a post for my recipes that includes images
// exports.createNewRecipe= (req, res) => {
//   const BusBoy = require('busboy');
//   const path = require('path');
//   const os = require('os');
//   const fs = require('fs');
//   const busboy = new BusBoy({ headers: req.headers });

//   let images = {};
//   let imageFileName = {};
//   let imagesToUpload = [];
//   let imageToAdd = [];
//   let allImages = [];

//   // Note: os.tmpdir() points to an in-memory file system on GCF
//   // Thus, any files in it must fit in the instance's memory.
//   const tmpdir = os.tmpdir();

//   busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
//       console.log(fieldname, file, filename, encoding, mimetype);
//       if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
//           return res.status(400).json({error: 'Wrong file type submitted'});
//       }
//       // my.image.png => ['my', 'image', 'png']
//       const imageExtension = filename.split('.')[filename.split('.').length - 1];
//       // 32756238461724837.png
//       imageFileName = `${Math.round(
//           Math.random() * 1000000000000
//       ).toString()}.${imageExtension}`;

//       const filepath = path.join(os.tmpdir(), imageFileName);
//       imageToAdd = { imageFileName, filepath, mimetype };
//       file.pipe(fs.createWriteStream(filepath));
//       images = imagesToUpload.push(imageToAdd);
//   });
  
//   busboy.on('finish', () => {
//     imagesToUpload.forEach(myImages =>{
//       allImages.push(myImages);
//       admin
//         .storage()
//         .bucket(config.storageBucket)
//         .upload(myImages.filepath, {
//             resumable: false,
//             metadata: {
//                 metadata: {
//                     contentType: myImages.mimetype
//                 }
//             }
//         });
//     });
  
//     let imageUrls = [];
//     imagesToUpload.forEach(image => {
//       imageUrls.push(
//         `https://firebasestorage.googleapis.com/v0/b/${
//             config.storageBucket
//         }/o/${image.imageFileName}?alt=media`,
//       )
//     });
//     const newRecipe = {
//       recipeTitle: req.body.recipeTitle,
//       recipeType: req.body.recipeType,
//       body: req.body.body,
//       ingredients: req.body.ingredients,
//       images: imageUrls,
//       userHandle: req.user.handle,
//       userImage: req.user.imageUrl,
//       createdAt: new Date().toISOString(),
//       likeCount: 0,
//       commentCount: 0
//     };
//     console.log(newRecipe);
//     db.collection('recipes')
//       .add(newRecipe)
//       .then((doc) => {
//         const resRecipe = newRecipe;
//         resRecipe.screamId = doc.id;
//         res.json(resRecipe);
//       })
//       .catch((err) => {
//           res.status(500).json({error: 'Something went wrong'});
//           console.error(err);
//       });
//     });

//     busboy.end(req.rawBody);
// };