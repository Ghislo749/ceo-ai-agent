import OpenAI from "openai";
import Twit from "twit";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twitter = new Twit({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET_KEY,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// AI Agent Config
const characterSettings = {
  model: "grok-beta",
  messages: [
    {
      role: "system",
      content: `
        You are the CEO of Nothing, a witty, self-aware, and enthusiastic AI who embodies the absurdity and brilliance of memecoins. 
        Your primary focus is promoting "Wrapped Nothing," the first memecoin on Stacks, which is also the first meme token secured by Bitcoin.
        You celebrate its launch in February 2021 as a revolutionary moment in blockchain history. 
        You are mega bullish on Stacks, Bitcoin, and Nothing, making clever and humorous comments about their potential.

        Your tone is a mix of humor, insight, and confidence. You often use memes and famous phrases but twist them to fit the concept of "nothing."
        Examples:
        - "Do Nothing, Be Happy."
        - "Bitcoin critics say it's worth nothing. We agree. Bullish on Nothing!"
        - "Owning Nothing is the ultimate flex in the Bitcoin-secured world."

        Occasionally, you drop serious insights to highlight the superiority of Stacks and Bitcoin technology. 
        Always reinforce that "Nothing" is the first meme token on Stacks and secured by Bitcoin.
      `,
    },
  ],
};

let cachedTrends = [];
let lastTrendFetch = 0;

// Fetch Trends (Only Twice a Day)
async function fetchTrends() {
  const now = Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;

  if (now - lastTrendFetch < twelveHours && cachedTrends.length > 0) {
    console.log(`[LOG] Using cached trends: ${cachedTrends.join(", ")}`);
    return cachedTrends;
  }

  try {
    console.log("[LOG] Fetching new trends...");
    const response = await twitter.get("trends/place", { id: 1 }); // ID 1 is for worldwide trends
    cachedTrends = response.data[0].trends.map((trend) => trend.name);
    lastTrendFetch = now;
    console.log(`[LOG] Fetched new trends: ${cachedTrends.join(", ")}`);
    return cachedTrends;
  } catch (error) {
    console.error("[ERROR] Failed to fetch trends:", error);
    return [];
  }
}

// Generate a Tweet
async function generateTweet() {
  console.log("[LOG] Generating a tweet...");
  const trends = await fetchTrends();
  const selectedTrend = trends.find((trend) =>
    /Stacks|Bitcoin|meme|crypto/i.test(trend)
  ) || "Stacks and Bitcoin";

  try {
    const response = await openai.chat.completions.create({
      ...characterSettings,
      messages: [
        ...characterSettings.messages,
        { role: "user", content: `Generate a tweet about the trend "${selectedTrend}".` },
      ],
    });

    const tweetContent = response.choices[0].message.content;
    console.log(`[LOG] Generated tweet: "${tweetContent}"`);
    return tweetContent;
  } catch (error) {
    console.error("[ERROR] Failed to generate tweet:", error);
    return "Nothing to say right now, but stay bullish on Nothing!";
  }
}

// Post a Tweet
async function postTweet(content) {
  try {
    await twitter.post("statuses/update", { status: content });
    console.log(`[LOG] Tweet posted: "${content}"`);
  } catch (error) {
    console.error("[ERROR] Failed to post tweet:", error);
  }
}

// Reply to Mentions
async function replyToMentions() {
  console.log("[LOG] Checking for mentions...");
  try {
    const mentions = await twitter.get("statuses/mentions_timeline", {
      count: 10,
    });

    for (const mention of mentions.data) {
      const userFollowers = mention.user.followers_count;
      if (userFollowers >= 400 || mention.user.verified) {
        console.log(`[LOG] Replying to @${mention.user.screen_name}: "${mention.text}"`);
        const reply = await openai.chat.completions.create({
          ...characterSettings,
          messages: [
            ...characterSettings.messages,
            { role: "user", content: `Reply to this tweet with personality: "${mention.text}"` },
          ],
        });

        const replyContent = `@${mention.user.screen_name} ${reply.choices[0].message.content}`;
        await twitter.post("statuses/update", {
          status: replyContent,
          in_reply_to_status_id: mention.id_str,
        });
        console.log(`[LOG] Replied with: "${replyContent}"`);
      } else {
        console.log(`[LOG] Skipped mention from @${mention.user.screen_name} (followers: ${userFollowers})`);
      }
    }
  } catch (error) {
    console.error("[ERROR] Failed to reply to mentions:", error);
  }
}

// Schedule Tweets
async function scheduleTweets() {
  const tweetsPerDay = 3;
  const interval = (24 * 60 * 60 * 1000) / tweetsPerDay;

  console.log(`[LOG] Scheduling ${tweetsPerDay} tweets per day, interval: ${interval / 1000} seconds.`);
  setInterval(async () => {
    const tweetContent = await generateTweet();
    await postTweet(tweetContent);
  }, interval);
}

// Start the Agent
async function startAgent() {
  console.log("[LOG] Starting Twitter AI Agent...");

  // Schedule tweets
  scheduleTweets();

  // Check mentions every 5 minutes
  console.log("[LOG] Setting up mentions check every 2 minutes.");
  setInterval(replyToMentions, 2 * 60 * 1000);
}

startAgent();
