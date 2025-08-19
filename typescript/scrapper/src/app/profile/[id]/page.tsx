import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import * as schema from "@/db/schema";
import { db } from "@/lib/db";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.id, id),
    with: {
      articles: true,
      employments: true,
      projects: true,
      socials: true,
    },
  });

  if (!profile) {
    return notFound();
  }

  return (
    <div className="relative h-[640px] w-full overflow-hidden border-t border-b border-dashed border-stone-400">
      <div className="relative h-full w-full grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Profile Header */}
        <div className="col-span-1 w-full h-full overflow-hidden border-r border-dashed border-stone-400">
          <div className="w-full flex-none border-b border-dashed border-stone-400 px-6 py-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {profile.name}
              </h1>
              <div className="w-16 h-0.5 bg-stone-400 mx-auto"></div>
              <p className="text-gray-600 mt-2 text-sm">Profile Summary</p>
            </div>
          </div>

          <div className="flex-1 w-full overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="border border-dashed border-stone-400 p-4 rounded">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b border-dashed border-stone-400 pb-2">
                  Personal Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-600 text-xs">Residence</span>
                    <p className="text-gray-900 font-medium">
                      {profile.residence}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 text-xs">Age Range</span>
                    <p className="text-gray-900 font-medium">
                      {profile.estimatedAgeMin}-{profile.estimatedAgeMax} years
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 text-xs">Salary Range</span>
                    <p className="text-gray-900 font-medium">
                      ${profile.estimatedSalaryMin}-$
                      {profile.estimatedSalaryMax}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 text-xs">Interests</span>
                    <p className="text-gray-900 font-medium">
                      {profile.interests}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-dashed border-stone-400 p-4 rounded">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b border-dashed border-stone-400 pb-2">
                  Employment History
                </h3>
                <div className="space-y-3">
                  {profile.employments.map((job, index) => (
                    <div
                      key={index}
                      className="border-l-2 border-stone-400 pl-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-gray-900 font-medium text-sm">
                            {job.position}
                          </p>
                          <p className="text-gray-600 text-xs">{job.company}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-700 text-xs">
                            {job.startDate}
                          </p>
                          {job.endDate && (
                            <p className="text-gray-700 text-xs">
                              {job.endDate}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="col-span-1 w-full h-full overflow-hidden flex flex-col">
          <div className="w-full flex-none border-b border-dashed border-stone-400 px-6 py-2">
            <div className="flex items-center gap-4 text-sm text-gray-700">
              <span>ID: {id?.slice(0, 8)}...</span>
              <span>Profile Type: Professional</span>
            </div>
          </div>

          <div className="flex-1 w-full overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="border border-dashed border-stone-400 p-4 rounded">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b border-dashed border-stone-400 pb-2">
                  Notable Projects
                </h3>
                <div className="space-y-3">
                  {profile.projects.map((project, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-stone-300 rounded"
                    >
                      <span className="text-gray-900 font-medium text-sm">
                        {project.name}
                      </span>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 text-xs px-3 py-1 border border-orange-400 transition-colors rounded"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-dashed border-stone-400 p-4 rounded">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b border-dashed border-stone-400 pb-2">
                  Articles & Content
                </h3>
                <div className="space-y-3">
                  {profile.articles.map((article, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-stone-300 rounded"
                    >
                      <span className="text-gray-900 font-medium text-sm">
                        {article.title}
                      </span>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-700 text-xs px-3 py-1 border border-orange-400 transition-colors rounded"
                      >
                        Read
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-dashed border-stone-400 p-4 rounded">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b border-dashed border-stone-400 pb-2">
                  Social Media
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {profile.socials.map((social, index) => (
                    <a
                      key={index}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-gray-50 border border-stone-300 hover:bg-gray-100 transition-colors text-center rounded text-xs text-gray-700 truncate"
                    >
                      {social.url}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
