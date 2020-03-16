exports.createRecipe = (req, res) => {
  const noImage = 'no-image.png';

  const inputFields = {
      // title: req.body,
      // body: req.body,
      // email: req.body,
      // category: req.body,
      // AddressOne: req.body,
      // createdAt: new Date().toISOString()
      recipeTitle: req.body.recipeTitle,
      recipeType: req.body.recipeType,
      body: req.body.body,
      ingredients: req.body.ingredients,
      userHandle: req.user.handle,
      userImage: req.user.imageUrl,
      recipeImage: req.body.recipeImage,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0
  };
  console.log("postOneRecipe", newRecipe);

  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');
  const busboy = new BusBoy({
      headers: req.headers,
      limits: {
          // Cloud functions impose this restriction anyway
          fileSize: 10 * 1024 * 1024,
      }
  });

  let images = {};
  let imageFileName = {};
  let imagesToUpload = [];
  let imageToAdd = [];
  let allImages = [];

  const fields = inputFields;

  // Note: os.tmpdir() points to an in-memory file system on GCF
  // Thus, any files in it must fit in the instance's memory.
  const tmpdir = os.tmpdir();

  busboy.on('field', (key, value) => {
      // You could do additional deserialization logic here, values will just be
      // strings
      fields[key] = value;
  });

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.log(fieldname, file, filename, encoding, mimetype);
      if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
          return res.status(400).json({error: 'Wrong file type submitted'});
      }
      // my.image.png => ['my', 'image', 'png']
      const imageExtension = filename.split('.')[filename.split('.').length - 1];
      // 32756238461724837.png
      imageFileName = `${Math.round(
          Math.random() * 1000000000000
      ).toString()}.${imageExtension}`;
      const filepath = path.join(os.tmpdir(), imageFileName);
      imageToAdd = {imageFileName, filepath, mimetype};
      file.pipe(fs.createWriteStream(filepath));
      images = imagesToUpload.push(imageToAdd);
  });

  busboy.on('finish', () => {
      imagesToUpload.forEach(myImages => {
          allImages.push(myImages);
          admin
              .storage()
              .bucket()
              .upload(myImages.filepath, {
                  resumable: false,
                  metadata: {
                      metadata: {
                          contentType: myImages.mimetype
                      }
                  }
              });
      });

      //return res.json(newRecipe)

      let imageUrls = [];
      imagesToUpload.forEach(image => {
          imageUrls.push(
              `https://firebasestorage.googleapis.com/v0/b/${
                  config.storageBucket
              }/o/${image.imageFileName}?alt=media`,
          )

      });
      const newRecipe = {
          body: inputFields.body,
          userHandle: req.user.handle,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          title: inputFields.title,
          rating: inputFields.ratings + 'star',
          userImage: req.user.imageUrl,
          images: imageUrls,
          replies: 0,
          reportCount: 0,
          business: inputFields.businessName,
          customerService: inputFields.customerService + 'star',
          createdAt: new Date().toISOString()
      };

      const tempBusiness = {
          claimed: false,
          businessName: inputFields.businessName,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          handle: inputFields.businessName,
          AddressOne: inputFields.AddressOne,
          email: inputFields.email,
          SMHandle: inputFields.SMHandle,
          category: inputFields.category,
          logoUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImag}?alt=media`,
          /* image1: req.body.image1,*/
          createdAt: new Date().toISOString()
      };

      db.collection('recipes')
          .add(newRecipe).then((doc) => {
          return db.doc(`/businesses/${inputFields.businessName}`).set(tempBusiness);
      }).then(() => {
          return res.status(201).json({message: 'recipe submitted successfully'});
      })
      .catch((err) => {
          res.status(500).json({error: 'Something went wrong'});
          console.error(err);
      });
  });
  busboy.end(req.rawBody);
};