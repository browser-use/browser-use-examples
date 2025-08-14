"use client";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ChatMessage } from "@/app/api/chat/route";

const MODELS = [
  {
    name: "GPT 4o",
    value: "openai/gpt-4o",
  },
  {
    name: "Deepseek R1",
    value: "deepseek/deepseek-r1",
  },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].value);
  const { messages, sendMessage, status } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        sendMessage(
          { text: input },
          {
            body: {
              model: model,
            },
          },
        );
        setInput("");
      }
    },
    [input, model, sendMessage],
  );

  const liveUrl = useMemo(() => {
    let url: string | undefined = undefined;

    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type === "tool-runTask" && part.output != null) {
          const output = part.output;

          if (output.liveUrl != null) {
            url = output.liveUrl;
          }
        }
      }
    }

    return url;
  }, [messages]);

  useEffect(() => {
    console.log(messages);
  }, [messages]);

  return (
    <div className="w-full h-full grid grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
      <div className="col-span-1 row-span-1">
        <div className="w-full h-full border-b md:border-b-0 md:border-r border-dashed border-gray-400">
          {/* Placeholder */}
          <div className="w-full h-full flex items-center justify-center">
            {liveUrl != null ? (
              <iframe src={liveUrl} className="w-full h-full border border-transparent" />
            ) : (
              <Image src="/browseruse.svg" alt="logo" width={40} height={40} className="size-16 object-contain" />
            )}
          </div>
        </div>
      </div>
      <div className="col-span-1 row-span-1 h-full flex flex-col overflow-hidden">
        <Conversation className="flex-1 overflow-hidden border-r border-transparent">
          <ConversationContent>
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case "text":
                        return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                      case "reasoning":
                        return (
                          <Reasoning key={`${message.id}-${i}`} className="w-full" isStreaming={status === "streaming"}>
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      case "tool-continueTask":
                      case "tool-runTask": {
                        if (part.output == null) {
                          return (
                            <Reasoning
                              key={`${message.id}-${i}`}
                              className="w-full mb-0"
                              isStreaming={status === "streaming"}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>Starting browser...</ReasoningContent>
                            </Reasoning>
                          );
                        }

                        if (part.output.status === "done") {
                          return <Response key={`${message.id}-${i}`}>{part.output.output}</Response>;
                        }

                        return (
                          <Reasoning
                            key={`${message.id}-${i}`}
                            className="w-full mb-0"
                            isStreaming={status === "streaming"}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.output.lastStep.nextGoal}</ReasoningContent>
                          </Reasoning>
                        );
                      }

                      default:
                        return null;
                    }
                  })}
                </MessageContent>
              </Message>
            ))}

            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input */}
        <div className="flex-none p-2 pt-0">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea onChange={(e) => setInput(e.target.value)} value={input} />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputModelSelect
                  onValueChange={(value) => {
                    setModel(value);
                  }}
                  value={model}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {MODELS.map((model) => (
                      <PromptInputModelSelectItem key={model.value} value={model.value}>
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit disabled={!input} status={status} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
