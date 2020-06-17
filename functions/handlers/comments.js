const { admin, db } = require("../util/admin");
const config = require("../util/config");

exports.deleteComment = async (req, res) => {
  try {
    const commentSnapshot = await db
      .doc(`/comments/${req.params.commentId}`)
      .get();

    if (!commentSnapshot.exists) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const comment = commentSnapshot.data();

    const postsByUser = await db
      .collection("screams")
      .where("userHandle", "==", req.user.handle)
      .orderBy("createdAt", "desc")
      .get();

    const userPostIds = postsByUser.docs.map((doc) => doc.id);

    // TODO: if comment wasnt posted by user or on user's post return 403
    if (
      comment.userHandle === req.user.handle ||
      userPostIds.includes(comment.postId)
    ) {
      return res.json({ message: "can delete", comment });
    } else {
      return res.status(403).json({ message: "Unauthorized" });
    }

    return res.json(comment);
  } catch (err) {
    //   console.log
    return res.status(500).json(err);
  }
};
