import { View, Image, StyleSheet, Text } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"

interface ProfileAvatarProps {
  avatar?: string | null
  size?: number
  name?: string
  showBorder?: boolean
}

export default function ProfileAvatar({ avatar, size = 80, name = "", showBorder = true }: ProfileAvatarProps) {
  const getInitials = (fullName: string) => {
    if (!fullName) return "?"
    const names = fullName.trim().split(" ")
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase()
    }
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase()
  }

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  }

  const containerStyle = {
    ...avatarStyle,
    borderWidth: showBorder ? 3 : 0,
    borderColor: "#fff",
  }

  if (avatar) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Image source={{ uri: avatar }} style={[styles.image, avatarStyle]} resizeMode="cover" />
      </View>
    )
  }

  return (
    <View style={[styles.container, styles.placeholder, containerStyle]}>
      {name ? (
        <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
      ) : (
        <MaterialIcons name="person" size={size * 0.5} color="#9CA3AF" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: "#F3F4F6",
  },
  initials: {
    fontWeight: "600",
    color: "#6B7280",
  },
})
