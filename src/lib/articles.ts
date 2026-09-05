import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import { getInternalAuthSecret } from "@/lib/env";
const listRef=makeFunctionReference<"query">("articles:list"), getRef=makeFunctionReference<"query">("articles:get"), saveRef=makeFunctionReference<"mutation">("articles:save"), removeRef=makeFunctionReference<"mutation">("articles:remove");
export type Article={id:string;guildId:string;title:string;description:string;tags:string[];body:string;attachments:string[];authorId:string;createdAt:string;updatedAt:string};
export const listArticles=(guildId:string)=>fetchQuery(listRef,{secret:getInternalAuthSecret(),guildId}) as Promise<Article[]>;
export const getArticle=(articleId:string)=>fetchQuery(getRef,{secret:getInternalAuthSecret(),articleId:articleId as never}) as Promise<Article|null>;
export const saveArticle=(input:Omit<Article,"id"|"createdAt"|"updatedAt">&{id?:string})=>fetchMutation(saveRef,{secret:getInternalAuthSecret(),guildId:input.guildId,authorId:input.authorId,articleId:input.id as never,title:input.title,description:input.description,tags:input.tags,body:input.body,attachments:input.attachments});
export const removeArticle=(guildId:string,articleId:string)=>fetchMutation(removeRef,{secret:getInternalAuthSecret(),guildId,articleId:articleId as never});
