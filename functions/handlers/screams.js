const { admin, db } = require("../util/admin");
const config = require("../util/config");

const { getMediaFileName } = require("../util/helpers");

/*********************** 
// Fetch all scream
Get: /api/screams
No Headers / No Body
************************/
exports.getAllScreams = (req, res) => {
  db.collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let screams = [];
      data.forEach((doc) => {
        screams.push({
          postId: doc.id,
          createdAt: doc.data().createdAt,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          images: doc.data().images,
        });
      });
      console.log("getAllScreams", screams);
      return res.json(screams);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// post one scream
Post: /api/scream
Body: {
  "body": "New Scream",
  "userHandle": "testUser"
}
Headers: Bearer (Authorization Token)
************************/
exports.postOneScream = (req, res) => {
  if (req.body.body.trim() === "") {
    return res.status(400).json({ body: "Body must not be empty" });
  }

  const newScream = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };
  console.log("postOneScream", newScream);

  db.collection("screams")
    .add(newScream)
    .then((doc) => {
      const resScream = newScream;
      resScream.postId = doc.id;
      res.json(resScream);
    })
    .catch((err) => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
};

/*********************** 
// post a scream with image
Headers: Bearer (Authorization Token)
************************/
exports.postNewScream = (req, res) => {
  // if (req.body.body.trim() === "") {
  //   return res.status(400).json({ body: "Body must not be empty" });
  // }
  const screamData = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };
  console.log("postNewScream", screamData);

  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");
  const busboy = new BusBoy({
    headers: req.headers,
    limits: {
      // Cloud functions impose this restriction anyway
      fileSize: 10 * 1024 * 1024,
    },
  });

  let images = {};
  let imageFileName = {};
  let imagesToUpload = [];
  let imageToAdd = [];
  let allImages = [];

  const fields = screamData;

  // Note: os.tmpdir() points to an in-memory file system on GCF
  // Thus, any files in it must fit in the instance's memory.
  const tmpdir = os.tmpdir();

  busboy.on("field", (key, value) => {
    // You could do additional deserialization logic here, values will just be
    // strings
    fields[key] = value;
  });

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    console.log(fieldname, file, filename, encoding, mimetype);
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "Wrong file type submitted" });
    }
    // my.image.png => ['my', 'image', 'png']
    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    // 32756238461724837.png
    imageFileName = `${Math.round(
      Math.random() * 1000000000000
    ).toString()}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToAdd = { imageFileName, filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
    images = imagesToUpload.push(imageToAdd);
  });

  busboy.on("finish", () => {
    imagesToUpload.forEach((myImages) => {
      allImages.push(myImages);

      admin
        .storage()
        .bucket()
        .upload(myImages.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: myImages.mimetype,
            },
          },
        });
    });

    let imageUrls = [];
    imagesToUpload.forEach((image) => {
      imageUrls.push(
        `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${image.imageFileName}?alt=media`
      );
    });
    const screams = {
      body: screamData.body,
      userHandle: req.user.handle,
      userImage: req.user.imageUrl,
      images: imageUrls,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
    };

    db.collection("screams")
      .add(screams)
      .then((doc) => {
        return res
          .status(201)
          .json({ message: "screams submitted successfully" });
      })
      .catch((err) => {
        res.status(500).json({ error: "Something went wrong" });
        console.error(err);
      });
  });

  busboy.end(req.rawBody);
};

/*********************** 
// Fetch one scream
Get: /api/scream/(ScreamId: MVz7Dhjkc3jjLHCFhpAV)
No Headers / No Body
************************/
exports.getScream = (req, res) => {
  let screamData = {};
  db.doc(`/screams/${req.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      screamData = doc.data();
      screamData.postId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc") // 2:42:00 need to create comments index in firebase
        .where("postId", "==", req.params.postId)
        .get();
    })
    .then((data) => {
      screamData.comments = [];
      data.forEach((doc) => {
        screamData.comments.push(doc.data());
      });
      return res.json(screamData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// Comment on a Scream
Post: /api/scream/(ScreamId: MVz7Dhjkc3jjLHCFhpAV)/comment
Headers: Bearer (Authorization Token)
Body: {
	"body": "Comment on a Scream"
}
************************/
exports.commentOnScream = (req, res) => {
  if (req.body.body.trim() === "")
    return res.status(400).json({ comment: "Must not be empty" });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    postId: req.params.postId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
  };
  console.log(newComment);

  db.doc(`/screams/${req.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong" });
    });
};

/*********************** 
// Like a scream
Get: /api/scream/MVz7Dhjkc3jjLHCFhpAV/like
Headers: Bearer (Authorization Token)
************************/
exports.likeScream = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("postId", "==", req.params.postId)
    .limit(1);

  const screamDocument = db.doc(`/screams/${req.params.postId}`);

  let screamData;

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.postId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Scream not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            postId: req.params.postId,
            userHandle: req.user.handle,
          })
          .then(() => {
            screamData.likeCount++;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return res.json(screamData);
          });
      } else {
        return res.status(400).json({ error: "Scream already liked" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// Unlike a scream
Get: /api/scream/MVz7Dhjkc3jjLHCFhpAV/unlike
Headers: Bearer (Authorization Token)
************************/
exports.unlikeScream = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("postId", "==", req.params.postId)
    .limit(1);

  const screamDocument = db.doc(`/screams/${req.params.postId}`);

  let screamData;

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.postId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Scream not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "Scream not liked" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            screamData.likeCount--;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            res.json(screamData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

/*********************** 
// Delete a scream
Delete: /api/scream/0fgCErKMixJoGZt65WtV
Headers: Bearer (Authorization Token)
No body 
************************/
exports.deleteScream = (req, res) => {
  const document = db.doc(`/screams/${req.params.postId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Scream deleted successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// Add a media file to a scream's collection of media
exports.uploadScreamMedia = (req, res) => {
  const document = db.doc(`/screams/${req.params.screamId}`);
  document
    .get()
    .then((screamDoc) => {
      if (!screamDoc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      if (screamDoc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        // Scream is indeed owned by user
        const scream = screamDoc.data();
        const oldMediaUrl = scream.mediaUrl;

        const BusBoy = require("busboy");
        const path = require("path");
        const os = require("os");
        const fs = require("fs");
        const { uuid } = require("uuidv4");

        const busboy = new BusBoy({ headers: req.headers });

        let mediaToBeUpload = {};
        // Media object to store and return as response
        let mediaObject = {
          accessToken: uuid(),
        };

        busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
          // Alowed file types (you can add other extensions if you wish)
          let allowedTypes = ["image/jpeg", "image/png", "video/mp4"];
          // If mimtype isnt in allowed types return error
          if (!allowedTypes.includes(mimetype)) {
            return res
              .status(400)
              .json({ error: `File type ${mimetype} is not allowed` });
          }
          // my.image.png => ['my', 'image', 'png']
          mediaObject.extension = filename.split(".")[
            filename.split(".").length - 1
          ];
          // Generate a random name
          mediaObject.name = `${Math.round(Math.random() * 1000000000000)}`;
          // Get tmep file path
          const filepath = path.join(
            os.tmpdir(),
            `${mediaObject.name}.${mediaObject.extension}`
          );
          mediaToBeUpload = { filepath, mimetype };
          file.pipe(fs.createWriteStream(filepath));
        });

        busboy.on("finish", () => {
          admin
            .storage()
            .bucket()
            .upload(mediaToBeUpload.filepath, {
              resumable: false,
              metadata: {
                metadata: {
                  contentType: mediaToBeUpload.mimetype,
                  //Generate token to be appended to imageUrl
                  firebaseStorageDownloadTokens: mediaObject.accessToken,
                },
              },
            })
            .then(() => {
              // Append token to url
              // TODO: Create a media record
              mediaObject.url = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${mediaObject.name}.${mediaObject.extension}?alt=media&token=${mediaObject.accessToken}`;
              mediaObject.screamId = screamDoc.id;

              return db.collection("media").add(mediaObject);
            })
            .then((doc) => {
              mediaObject.id = doc.id;

              return res.json(mediaObject);
            })
            // .then(() => {
            //   // Delete old media if exists
            //   if (oldMediaUrl) {
            //     const filename = getMediaFileName(oldMediaUrl);
            //     // Delete file
            //     return admin.storage().bucket().deleteFiles({
            //       prefix: filename,
            //     });
            //   }
            // })
            .catch((err) => {
              console.error(err);
              return res.status(500).json({ error: "something went wrong" });
            });
        });
        busboy.end(req.rawBody);
      }
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.deleteScreamMedia = (req, res) => {
  // Find scream
  const document = db.doc(`/screams/${req.params.screamId}`);

  document
    .get()
    .then((screamDoc) => {
      if (!screamDoc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      if (screamDoc.data().userHandle !== req.user.handle) {
        // Check if user isnt owner of scream
        console.log("User doesnt own scream");
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        // Find media
        return db.doc(`/media/${req.params.mediaId}`).get();
      }
    })
    .then((mediaDoc) => {
      if (!mediaDoc.exists) {
        return res.status(404).json({ error: "Media not found" });
      } else if (mediaDoc.data().screamId !== req.params.screamId) {
        // Ensure media file belongs to scream
        console.log("Media doesnt belong to scream");
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Delete media file
      return admin.storage().bucket().deleteFiles({
        prefix: mediaDoc.data().name,
      });
    })
    .then(() => {
      // Delete media collection entry
      return db.doc(`/media/${req.params.mediaId}`).delete();
    })
    .then(() => {
      res.status(200).json({ message: "Media deleted successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
