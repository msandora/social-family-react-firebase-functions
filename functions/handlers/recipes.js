const { db } = require('../util/admin');

exports.getAllRecipes = (req, res) => {
  db.collection('recipes')
    .orderBy('createdAt', 'desc')
    .get()
    .then((data) => {
      let recipes = [];
      data.forEach((doc) => {
        recipes.push({
            recipeId: doc.id,
            recipeTitle: doc.data().recipeTitle,
            recipeType: doc.data().recipeType,
            body: doc.data().body,
            createdAt: doc.data().createdAt,
            ingredients: doc.data().ingredients,
            commentCount: doc.data().commentCount,
            likeCount: doc.data().likeCount,
            userHandle: doc.data().userHandle,
            userImage: doc.data().userImage
        });
      });
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
		recipeTitle: req.body.title,
		recipeType: req.body.type,
		body: req.body.body,
		ingredients: req.body.ingredients,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
	};

	db.collection('recipes')
		.add(newRecipe)
		.then((doc) => {
			const resRecipe = newRecipe;
			resRecipe.recipeId = doc.id;
			res.json(resRecipe);
		})
		.catch((err) => {
			res.status(500).json({ error: 'something went wrong' });
			console.error(err);
		});
};


/*********************** 
// Delete a recipe
Delete: /api/recipe/0fgCErKMixJoGZt65WtV
Headers: Bearer (Authorization Token)
No body 
************************/
exports.deleteRecipe = (req, res) => {
  const document = db.doc(`/recipes/${req.params.recipeId}`);
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