import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import { sendUserSignupAlert } from "../services/slackService.js";

export const configurePassport = () => {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
        scope: ["user:email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract email from GitHub profile
          const email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value
              : null;

          if (!email) {
            return done(
              new Error("No email associated with this GitHub account"),
              null,
            );
          }

          // Check if a user with this email already exists with local auth
          const existingLocalUser = await User.findOne({
            email: email.toLowerCase(),
            authProvider: "local",
          });

          if (existingLocalUser) {
            // Return error - email already registered with local account
            return done(
              new Error(
                "An account with this email already exists. Please login with your email and password.",
              ),
              null,
            );
          }

          // Check if user already exists with GitHub
          let user = await User.findOne({ githubId: profile.id });

          if (user) {
            // User exists, return the user
            return done(null, user);
          }

          // Check if user exists with same email but different provider
          user = await User.findOne({ email: email.toLowerCase() });

          if (user && user.authProvider === "github") {
            // User exists with GitHub provider, update githubId if missing
            if (!user.githubId) {
              user.githubId = profile.id;
              await user.save();
            }
            return done(null, user);
          }

          // Create new user
          user = new User({
            name: profile.displayName || profile.username,
            email: email.toLowerCase(),
            githubId: profile.id,
            authProvider: "github",
            isEmailVerified: true, // Trust GitHub's email verification
          });

          await user.save();

          // Send Slack notification for new signup (fire and forget)
          sendUserSignupAlert(user).catch((err) => {
            console.error("[Passport GitHub] Slack notification failed:", err);
          });

          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      },
    ),
  );
};

export default passport;
