import os
import logging
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from slack_sdk.signature import SignatureVerifier
from service import SlackService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

app = FastAPI()


@app.post('/slack/events')
async def slack_events(
	request: Request
):
	try:
		signing_secret = os.getenv('SLACK_SIGNING_SECRET')
		browser_use_api_key = os.getenv('BROWSER_USE_API_KEY')
		access_token = os.getenv('SLACK_ACCESS_TOKEN')
		if not signing_secret or not browser_use_api_key or not access_token:
			raise HTTPException(status_code=500, detail='Environment variables not configured')

		if not SignatureVerifier(signing_secret).is_valid_request(
			await request.body(), dict(request.headers)	
		):
			logger.warning('Request verification failed')
			raise HTTPException(status_code=400, detail='Request verification failed')

		event_data = await request.json()
		if 'challenge' in event_data:
			return {'challenge': event_data['challenge']}

		slack_bot = SlackService(browser_use_api_key, access_token)
		if 'event' in event_data:
			try:
				await slack_bot.handle_event(event_data)
			except Exception as e:
				logger.error(f'Error handling event: {str(e)}')

		return {}
	except HTTPException:
		raise
	except Exception as e:
		logger.error(f'Error in slack_events: {str(e)}')
		raise HTTPException(status_code=500, detail='Failed to process Slack event')

if __name__ == "__main__":
	uvicorn.run(app, host="0.0.0.0", port=8000)