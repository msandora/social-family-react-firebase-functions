Thank you for taking a moment to help, I am limited on resources so whenever a fellow developer offers to help I am very grateful. Thank you

Please note that I left the firebaseConfig empty since you would not have access to my firebase credentials. You can replace with your own for testing. 
line 7 of index.js

At this point I have redone this course up until this part 3 times and watched the video several times trying to figure out what I am doing wrong. firebase serve command has not been working for me so i have been using firebase deploy each time. 

During this course I encountered a 2 problems, if you can assist me with solving either of these issues or at least provide a better understanding of the issues I would be very grateful.

Issue #1
on line 24 of index.js you will see this line commented out
    // .orderBy('createdAt', 'desc')
When I run firebase deploy and test this it returns an empty object []
When I deploy without this the GET method returns screams correctly, I am unsure why this does not work

Issue #2
line 45 of index.js - my FBAuth function is not working correctly. This may come down to me not using postman correctly as I am new to this software and these concepts. Keep in mind I did try to follow every step in this video(1:19:33):
https://www.youtube.com/watch?v=m_u6P5k0vP0&t=795s
I am including some screenshots in the images folder

When I run a POST with the authorization header of "Bearer "
it returns:
{
    "error": "Unauthorized undefined Bearer"
}

When I run a POST with the authorization header of "Bearer test" (This is correct)
{
    "code": "auth/argument-error",
    "message": "Decoding Firebase ID token failed. Make sure you passed the entire string JWT which represents an ID token. See https://firebase.google.com/docs/auth/admin/verify-id-tokens for details on how to retrieve an ID token."
}

However when I run a POST with the authorization header of "Bearer {toke}" token being the token returned by my login post I get html markup:
	<pre>Internal Server Error</pre>

Someone suggested that I erase the old token but I was unsure what they meant by that. Before running the attempted scream I would rerun the login POST, I see that I get a new token each time so I tried adding newest token to Bearer {token} each time. 

It would seem that the idToken is always coming back as undefined no matter what I do
