module.exports.getMediaFileName = (url) => {
  // url example: https://firebasestorage.googleapis.com/v0/b/socialape-d081e.appspot.com/o/310025121799.jpg?alt=media&token=1756bbe9-a859-4518-b7d8-f6f1534899a4
  //  Get file name
  // firstPart example: https://firebasestorage.googleapis.com/v0/b/socialape-d081e.appspot.com/o/310025121799.jpg
  const firstPart = url.split("?alt=media")[0];
  // filename example: 310025121799.jpg
  const filename = firstPart.split("/o/")[1];

  return filename;
};
