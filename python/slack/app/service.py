import logging
import asyncio
from typing import Optional
from slack_sdk.errors import SlackApiError
from slack_sdk.web.async_client import AsyncWebClient
from browser_use import BrowserUse

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class SlackService:
	def __init__(self, api_key: str, access_token: str):		
		self.client = BrowserUse(api_key=api_key)
		self.access_token = access_token

	async def send_message(
		self, channel: str, text: str, thread_ts: Optional[str] = None
	):
		try:
			client = AsyncWebClient(token=self.access_token)
			response = await client.chat_postMessage(
				channel=channel, text=text, thread_ts=thread_ts
			)
			return response
		except SlackApiError as e:
			logger.error(f'Error sending message: {e.response["error"]}')

	async def update_message(self, channel: str, ts: str, text: str):
		try:
			client = AsyncWebClient(token=self.access_token)
			response = await client.chat_update(channel=channel, ts=ts, text=text)
			return response
		except SlackApiError as e:
			logger.error(f'Error updating message: {e.response["error"]}')

	async def handle_event(self, event_data):
		try:
			event_id = event_data.get('event_id')
			logger.info(f'Received event id: {event_id}')
			if not event_id:
				logger.warning('Event ID missing in event data')
				return

			event = event_data.get('event')

			text = event.get('text')
			channel_id = event.get('channel')

			if text and channel_id:
				# Extract the task by taking only the part after the bot mention
				# The text format is: "anything before <@BOT_ID> task description"
				import re

				mention_pattern = r'<@[A-Z0-9]+>'
				match = re.search(mention_pattern, text)

				if match:
					# Take everything after the bot mention
					task = text[match.end() :].strip()
				else:
					return

				# Only process if there's actually a task
				if not task:
					await self.send_message(
						channel_id,
						'Specify a task to execute.',
						thread_ts=event.get('ts'),
					)
					return

				# Start the async task to process the agent task
				asyncio.create_task(
					self.process_agent_task_async(
						task, channel_id
					)
				)

		except Exception as e:
			logger.error(f'Error in handle_event: {str(e)}')


	async def process_agent_task_async(
		self, task: str, channel_id: str
	):
		"""Async function to process the agent task and return share link immediately"""
		try:
			# Send initial "starting" message and capture its timestamp
			response = await self.send_message(
				channel_id, 'Starting browser use task...'
			)
			if not response or not response.get('ok'):
				logger.error(f'Failed to send initial message: {response}')
				return

			message_ts = response.get('ts')
			if not message_ts:
				logger.error('No timestamp received from Slack API')
				return

			# Start the agent task using internal service
			task_result = await self.client.tasks.create(task=task)

			if not task_result.session_id:
				# Error starting task
				error_message = f'Error: {task_result.message}'
				await self.update_message(channel_id, message_ts, error_message)
				return
			
			share_url = await self.client.sessions.retrieve(task_result.session_id)

			# Create final message with share link
			if share_url:
				final_message = (
					f'Agent task started!\n\nShare URL: {share_url.public_share_url}\n\nTask: {task}'
				)
			else:
				final_message = (
					f'Agent task started!\n\nTask: {task}\n\nNote: Share link could not be created.'
				)

			await self.update_message(channel_id, message_ts, final_message)

		except Exception as e:
			error_message = f'Error during task execution: {str(e)}'
			logger.error(f'Error in process_agent_task_async: {error_message}')

			# Send error message as a new message
			try:
				await self.send_message(
					channel_id, f'Error in task execution: {error_message}'
				)
			except Exception as send_error:
				logger.error(f'Failed to send error message: {str(send_error)}')