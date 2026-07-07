import * as React from "react"
import { Avatar, AvatarImage } from "@/components/ui/avatar"

interface UserAvatarProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number
  avatarLink: string
}

export function UserAvatar({ size = 24, avatarLink, className, ...props }: UserAvatarProps) {
  return (
      <Avatar className={className} {...props}>
        <AvatarImage src={avatarLink} alt="User Avatar" />
      </Avatar>
  )
}
