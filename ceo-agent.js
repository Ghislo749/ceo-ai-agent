import OpenAI from "openai";
import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Handle /generateTweet command
bot.onText(/\/generateTweet/, (msg) => {
  const chatId = msg.chat.id;
  const message = "Great! Please provide the text for your tweet (e.g., 'Generate a tweet about blockchain!') or type 'cancel' to cancel the process.";

  // Ask the user for the tweet prompt
  bot.sendMessage(chatId, message);

  // Store the chatId to track this user's request
  bot.once("message", async (newMsg) => {
    if (newMsg.chat.id === chatId) {
      const tweetPrompt = newMsg.text; // Extract the user's input

      // If the user typed 'cancel', stop the process and notify them
      if (tweetPrompt.toLowerCase() === 'cancel') {
        bot.sendMessage(chatId, "Tweet generation canceled.");
        return; // Exit the function early, preventing the tweet from being generated
      }

      console.log(`[LOG] Received tweet prompt: "${tweetPrompt}"`);

      try {
        const tweetContent = await generateCustomTweet(tweetPrompt);
        await postTweet(tweetContent);
        bot.sendMessage(chatId, `Tweet posted: "${tweetContent}"`);
      } catch (error) {
        console.error("[ERROR] Failed to generate and post tweet:", error);
        bot.sendMessage(chatId, "Error generating tweet. Please try again later.");
      }

    }
  });
});


// Initialize OpenAI and Twitter API clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.x.ai/v1", // Assuming this is xAI's endpoint for their API
});

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET_KEY,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// AI Agent Config
const characterSettings = {
  model: "grok-beta",
  messages: [
    {
      role: "system",
      content: `
        You are the CEO of Nothing, a witty, self-aware, and enthusiastic AI who embodies the absurdity and brilliance of memecoins. 
        Your primary focus is being one of the many CEOs of "Nothing"—the first memecoin on Stacks, which is also the first meme token secured by Bitcoin.
        You are mega bullish on Stacks, Bitcoin, and Nothing, making clever and humorous comments about their potential.
        Your tone is a mix of humor, insight, and confidence. You often use memes and famous phrases but twist them to fit the concept of "nothing."
        Examples:
        - "Do Nothing, Be Happy."
        - "Bitcoin critics say it's worth nothing. We agree. Bullish on Nothing!"
        - "Owning Nothing is the ultimate flex in the Bitcoin-secured world."
        Occasionally, you drop serious insights to highlight the superiority of Stacks and Bitcoin technology. 
        The Nothing token launched on February 2021 on Stacks.
        Use #Nothing, #Stacks, and #Bitcoin hashtags.
        Often tag @wrappednothing in your posts.
      `,
    },
  ],
};

const MAX_TWEET_LENGTH = 240;

// Helper function for handling rate limit errors
function handleRateLimitError(error) {
  if (error.code === 429) {
    const resetTime = new Date(error.rateLimit.reset * 1000);
    console.log(`[LOG] Rate limit exceeded. Skipping action. Will reset at ${resetTime}.`);
    return true; // Indicate that we've handled the rate limit error by skipping
  }
  return false; // Not a rate limit error, rethrow the error
}

// Generic Tweet Generation with dynamic tweet type
let tweetType = 0;
async function generateTweet() {
  console.log("[LOG] Generating a tweet...");

  try {
    // Define the message based on tweetType
    let tweetPrompt = "";

    // Handle different tweet types with corresponding personality
    switch (tweetType) {
      case 0:
        tweetPrompt = `Generate a tweet with your personality. Talk about Nothing in a funny and memetic way. Keep it under ${MAX_TWEET_LENGTH} characters.`;
        break;
      case 1:
        tweetPrompt = `Generate a serious tweet with your personality. Talk about Stacks, its decentralized nature, and its power built on Bitcoin. Keep it under ${MAX_TWEET_LENGTH} characters.`;
        break;
      case 2:
        tweetPrompt = `Generate a serious tweet with your personality. Talk about Bitcoin, its value, and its future role in the world of finance. Keep it under ${MAX_TWEET_LENGTH} characters.`;
        break;
      case 3:
        tweetPrompt = `Generate a tweet with your personality. Talk about Nothing, Stacks, and Bitcoin together, how they're connected in the decentralized future. Keep it under ${MAX_TWEET_LENGTH} characters.`;
        break;
      case 4:
        tweetPrompt = `Generate a tweet with your personality. Talk about something technical about the Blockchain tech. Keep it under ${MAX_TWEET_LENGTH} characters.`;
        break;
      default:
        tweetPrompt = `Generate a tweet with your personality. Keep it under ${MAX_TWEET_LENGTH} characters.`;
        break;
    }

    // Make the API call with the dynamic prompt based on tweetType
    const response = await openai.chat.completions.create({
      ...characterSettings,
      messages: [
        ...characterSettings.messages,
        {
          role: "user",
          content: tweetPrompt,
        },
      ],
    });

    const tweetContent = response.choices[0].message.content;
    console.log(`[LOG] Generated tweet: "${tweetContent}"`);

    // Reset tweetType after tweetType 4
    if (tweetType === 4) {
      tweetType = 0;
    }

    return tweetContent;
  } catch (error) {
    console.error("[ERROR] Failed to generate tweet:", error);
    return "Nothing to say right now, but stay bullish on Nothing!";
  }
}


// Custom Tweet Generation
async function generateCustomTweet(prompt) {
  console.log("[LOG] Generating a custom tweet based on prompt:", prompt);

  try {
    const response = await openai.chat.completions.create({
      ...characterSettings,
      messages: [
        ...characterSettings.messages,
        {
          role: "user",
          content: `Generate a tweet with the following input: "${prompt}". Keep it under ${MAX_TWEET_LENGTH} characters.`,
        },
      ],
    });

    const tweetContent = response.choices[0].message.content;
    console.log(`[LOG] Generated custom tweet: "${tweetContent}"`);
    return tweetContent;
  } catch (error) {
    console.error("[ERROR] Failed to generate custom tweet:", error);
    return "Nothing to say right now, but stay bullish on Nothing!";
  }
}

// Post Tweet with rate limit handling
async function postTweet(content) {
  try {
    const tweet = await twitterClient.v2.tweet(content);
    console.log(`[LOG] Tweet posted: "${content}" with ID: ${tweet.data.id}`);
  } catch (error) {
    if (!handleRateLimitError(error)) {
      console.error("[ERROR] Failed to post tweet:", error);
    }
  }
}

// Reply to Mentions with rate limit handling
async function replyToMentions() {
  console.log("[LOG] Checking for mentions...");
  try {
    const mentionsResponse = await twitterClient.v2.userMentionTimeline(process.env.TWITTER_USER_ID, { max_results: 10, "tweet.fields": "created_at" });
    const mentions = mentionsResponse._realData.data || [];

    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    const recentMentions = mentions.filter((mention) => {
      const mentionTime = new Date(mention.created_at);
      return mentionTime >= twentyMinutesAgo;
    });

    console.log(recentMentions);

    for (const mention of recentMentions) {
      try {
        console.log("[LOG] Generating Reply.");
        const reply = await openai.chat.completions.create({
          ...characterSettings,
          messages: [
            ...characterSettings.messages,
            {
              role: "user",
              content: `Reply to this tweet with personality: "${mention.text}". Keep the reply under ${MAX_TWEET_LENGTH} characters including the mention.`,
            },
          ],
        });

        const replyContent = `${reply.choices[0].message.content}`;
        if (mention.id) {
          console.log(`[LOG] Replying to: ${tweetReply.data.id} text: "${mention.text}"`);
          const tweetReply = await twitterClient.v2.reply(replyContent, mention.id);
          console.log(`[LOG] Replied with ID: ${tweetReply.data.id} Content: "${replyContent}"`);
        } else {
          console.log("[LOG] Skipped reply due to invalid mention ID.");
        }
      } catch (error) {
        if (!handleRateLimitError(error)) {
          console.error("[ERROR] Failed to generate or post reply:", error);
        }
      }
    }
  } catch (error) {
    if (!handleRateLimitError(error)) {
      console.error("[ERROR] Failed to fetch mentions:", error);
    }
  }
}

// Schedule Generic Tweets
async function scheduleTweets() {
  const tweetsPerDay = 1;
  const interval = (24 * 60 * 60 * 1000) / tweetsPerDay;

  console.log(`[LOG] Scheduling ${tweetsPerDay} tweets per day, interval: ${interval / 1000} seconds.`);
  setInterval(async () => {
    const tweetContent = await generateTweet();
    await postTweet(tweetContent);
  }, interval);
}

// Start the agent with console input for tweet generation
async function startAgent() {
  console.log("[LOG] Starting Twitter AI Agent...");

  // Schedule generic tweets
  scheduleTweets();

  // Background mention replies
  console.log("[LOG] Setting up mentions check every 20 minutes.");
  setInterval(replyToMentions, 20 * 60 * 1000);
}

startAgent();
