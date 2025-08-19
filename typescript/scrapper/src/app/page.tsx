"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

import { Input } from "@/components/ui/input";
import * as schema from "@/db/schema";

type ProfileItem = typeof schema.profiles.$inferSelect;

/**
 * Renders a list of scrapped profiles and allow to create new profiles.
 */
export default function DashboardPage() {
  const { data, mutate } = useSWR<ProfileItem[]>("/api/scrape/list", fetcher);

  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;

    setIsSubmitting(true);
    try {
      await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: input }),
      });

      await mutate();
    } catch (error) {
      console.error("Error creating profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [input, mutate]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await fetch(`/api/scrape/${id}`, {
        method: "DELETE",
      });
      await mutate();
    },
    [mutate]
  );

  return (
    <div className="w-full">
      <div className="border-t border-b border-dashed border-stone-400 flex items-center gap-2 p-3">
        <Input
          placeholder="Gregor Žunič"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Search
        </Button>
      </div>

      <table className="w-full">
        <thead className="border-b border-dashed border-stone-400 text-sm">
          <tr>
            <th className="text-left px-3 py-1 border-r border-dashed">Name</th>
            <th className="text-right px-3 py-1 w-12">Actions</th>
          </tr>
        </thead>

        <tbody>
          {data?.map((item) => (
            <tr
              key={item.id}
              className="border-b border-dashed border-gray-200 last:border-stone-400"
            >
              <td className="px-3 py-1 text-base font-medium border-r border-dashed flex items-center gap-2">
                <Link href={`/profile/${item.id}`} target="_blank">
                  {item.name}
                </Link>

                {item.status === "running" ? (
                  <Loader2 className="size-3 animate-spin text-orange-600" />
                ) : (
                  <CheckCircle className="size-3 text-green-500" />
                )}
              </td>

              <td className="px-3 py-1 text-base text-right">
                <div className="inline-flex items-center gap-2 justify-around">
                  <Link
                    href={`/live/${item.id}`}
                    className="text-orange-600 hover:text-orange-700 mr-2"
                    target="_blank"
                  >
                    Live
                  </Link>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="-my-1 p-1 rounded-sm hover:bg-gray-100 border border-gray-200"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
