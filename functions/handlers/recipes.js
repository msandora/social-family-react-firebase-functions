const { db } = require('../util/admin');

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
            createdAt: doc.data().createdAt,
            ingredients: doc.data().ingredients,
            likeCount: doc.data().likeCount,
            userHandle: doc.data().userHandle,
            userImage: doc.data().userImage
        });
      });
      // console.log("getAllRecipes", recipes);
      return res.json(recipes);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.postOneRecipe = (req, res) => {
	if (req.body.body.trim() === '') {
		return res.status(400).json({ body: 'Body must not be empty' });
	}

	const newRecipe = {
		recipeTitle: req.body.recipeTitle,
		recipeType: req.body.recipeType,
		body: req.body.body,
		ingredients: req.body.ingredients,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0
	};
  // console.log("postOneRecipe", newRecipe);

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