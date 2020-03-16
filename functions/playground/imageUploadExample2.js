// I am trying to create a post for my recipes that includes images
exports.createNewRecipe= (req, res) => {
  let rating = '1star';
  let recipeImages = {};
  const inputFields = {
      title: req.body,
      type: req.body,
      body: req.body,
      ingredients: req.body,
      ratings: req.body,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0
  };
  
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
      imagesToUpload.forEach(myImages =>{
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
        title: inputFields.title,
        type: inputFields.type,
        body: inputFields.body,
        ingredients: inputFields.ingredients,
        rating: inputFields.ratings + 'star',
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        images: imageUrls,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
      };

      if(newRecipe.rating=== '1star') rating = "bad";
      if(newRecipe.rating=== '2star') rating = "poor";
      if(newRecipe.rating=== '3star') rating = "average";
      if(newRecipe.rating=== '4star') rating = "great";
      if(newRecipe.rating=== '5star') rating = "excellent";
  
      let chartData = {};
      db.collection('recipes')
        .add(newRecipe).then((doc)=> {

        //update the chart data
        let myChart = db.collection("recipes").doc(newRecipe).doc(rating);

            myChart.get().then((doc)=>{
                chartData = doc.data();
              
                chartData.value++;
                return myChart.update({value: chartData.value }).then(()=>{
                    return res.status(201).json({message: 'recipe submitted successfully'});
                })
            })
        })
        .catch((err) => {
            res.status(500).json({error: 'Something went wrong'});
            console.error(err);
        });
      });
  
      busboy.end(req.rawBody);
};