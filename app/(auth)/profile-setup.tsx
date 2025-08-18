"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActionSheetIOS,
  Dimensions,
  StatusBar,
} from "react-native"
import { router } from "expo-router"
import { MaterialIcons } from "@expo/vector-icons"
import * as Crypto from "expo-crypto"
import { LinearGradient } from "expo-linear-gradient"
import DatabaseService from "../../services/DatabaseService"
import ProfileAvatar from "../../components/ProfileAvatar"

const { width, height } = Dimensions.get("window")

export default function ProfileSetup() {
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [bio, setBio] = useState("")
  const [avatar, setAvatar] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    initDatabase()
  }, [])

  const initDatabase = async () => {
    try {
      await DatabaseService.initDatabase()
    } catch (error) {
      console.error("Database initialization error:", error)
      Alert.alert("Error", "Failed to initialize database")
    }
  }

  const validateStep1 = () => {
    const newErrors: any = {}

    if (!username.trim()) {
      newErrors.username = "Username is required"
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters"
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format"
    }

    if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors: any = {}
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
      setErrors({})
    } else if (step === 2 && validateStep2()) {
      setStep(3)
      setErrors({})
    }
  }

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1)
      setErrors({})
    }
  }

  const handleAvatarPress = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Implement camera logic
          } else if (buttonIndex === 2) {
            // Implement gallery logic
          }
        },
      )
    } else {
      Alert.alert("Select Avatar", "Choose an option", [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => {} },
        { text: "Choose from Library", onPress: () => {} },
      ])
    }
  }

  const handleCreateAccount = async () => {
    if (!validateStep2()) return

    setLoading(true)

    try {
      const existingUser = await DatabaseService.getUserByUsername(username.trim())
      if (existingUser) {
        setLoading(false)
        return Alert.alert("Error", "Username already exists")
      }

      const userId = Crypto.randomUUID()

      await DatabaseService.createUser({
        userId,
        username: username.trim(),
        email: email.trim() || undefined,
        fullName: fullName.trim(),
        bio: bio.trim() || undefined,
        avatar: avatar || undefined,
      })

      await DatabaseService.createAuth(userId, password)

      Alert.alert("Success!", "Account created successfully.", [
        { text: "OK", onPress: () => router.replace("/(main)/home") },
      ])
    } catch (error) {
      console.error("Create account error:", error)
      Alert.alert("Error", "Failed to create account. Please try again.")
    }

    setLoading(false)
  }

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((stepNumber) => (
        <View key={stepNumber} style={styles.progressStep}>
          <View
            style={[
              styles.progressCircle,
              step >= stepNumber ? styles.progressCircleActive : styles.progressCircleInactive,
            ]}
          >
            {step > stepNumber ? (
              <MaterialIcons name="check" size={16} color="#fff" />
            ) : (
              <Text
                style={[
                  styles.progressText,
                  step >= stepNumber ? styles.progressTextActive : styles.progressTextInactive,
                ]}
              >
                {stepNumber}
              </Text>
            )}
          </View>
          {stepNumber < 3 && (
            <View
              style={[styles.progressLine, step > stepNumber ? styles.progressLineActive : styles.progressLineInactive]}
            />
          )}
        </View>
      ))}
    </View>
  )

  const renderInputField = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: string,
    secureTextEntry = false,
    showPasswordToggle = false,
    onTogglePassword?: () => void,
    keyboardType: any = "default",
    multiline = false,
    error?: string,
  ) => (
    <View style={styles.inputContainer}>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        <MaterialIcons name={icon as any} size={20} color="#6B7280" style={styles.inputIcon} />
        <TextInput
          style={[styles.input, multiline ? styles.inputMultiline : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
        {showPasswordToggle && (
          <TouchableOpacity onPress={onTogglePassword} style={styles.passwordToggle}>
            <MaterialIcons name={secureTextEntry ? "visibility-off" : "visibility"} size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Account Details</Text>
        <Text style={styles.stepSubtitle}>Create your account credentials</Text>
      </View>

      {renderInputField(
        username,
        setUsername,
        "Username",
        "person",
        false,
        false,
        undefined,
        "default",
        false,
        errors.username,
      )}

      {renderInputField(
        email,
        setEmail,
        "Email (optional)",
        "email",
        false,
        false,
        undefined,
        "email-address",
        false,
        errors.email,
      )}

      {renderInputField(
        password,
        setPassword,
        "Password",
        "lock",
        !showPassword,
        true,
        () => setShowPassword(!showPassword),
        "default",
        false,
        errors.password,
      )}

      {renderInputField(
        confirmPassword,
        setConfirmPassword,
        "Confirm Password",
        "lock",
        !showConfirmPassword,
        true,
        () => setShowConfirmPassword(!showConfirmPassword),
        "default",
        false,
        errors.confirmPassword,
      )}
    </View>
  )

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Personal Information</Text>
        <Text style={styles.stepSubtitle}>Tell us about yourself</Text>
      </View>

      {renderInputField(
        fullName,
        setFullName,
        "Full Name",
        "person",
        false,
        false,
        undefined,
        "default",
        false,
        errors.fullName,
      )}

      {renderInputField(bio, setBio, "Bio (optional)", "description", false, false, undefined, "default", true)}
    </View>
  )

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Profile Picture</Text>
        <Text style={styles.stepSubtitle}>Add a photo to personalize your profile</Text>
      </View>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarButton}>
          <ProfileAvatar avatar={avatar} size={120} />
          <View style={styles.avatarOverlay}>
            <MaterialIcons name="camera-alt" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarText}>Tap to add photo</Text>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Account Summary</Text>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Username:</Text>
          <Text style={styles.summaryValue}>{username}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Full Name:</Text>
          <Text style={styles.summaryValue}>{fullName}</Text>
        </View>
        {email && (
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Email:</Text>
            <Text style={styles.summaryValue}>{email}</Text>
          </View>
        )}
      </View>
    </View>
  )

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1()
      case 2:
        return renderStep2()
      case 3:
        return renderStep3()
      default:
        return renderStep1()
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />

      <LinearGradient colors={["#007AFF", "#184CC6FF"]} style={styles.header}>
        <View style={styles.headerContent}>
          {step > 1 && (
            <TouchableOpacity onPress={handlePrevStep} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            Create Account
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {renderProgressBar()}
      </LinearGradient>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        <View style={styles.buttonContainer}>
          {step < 3 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNextStep} disabled={loading}>
              <Text style={styles.nextButtonText}>Next</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.createButton} onPress={handleCreateAccount} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.createButtonText}>Create Account</Text>
                  <MaterialIcons name="check" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStep: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCircleActive: {
    backgroundColor: "#fff",
  },
  progressCircleInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressTextActive: {
    color: "#007AFF",
  },
  progressTextInactive: {
    color: "#fff",
  },
  progressLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: "#fff",
  },
  progressLineInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    marginBottom: 30,
    alignItems: "center",
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    minHeight: 56,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 16,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  passwordToggle: {
    padding: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 8,
    marginLeft: 4,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatarButton: {
    position: "relative",
    marginBottom: 12,
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarText: {
    fontSize: 16,
    color: "#6B7280",
  },
  summaryContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  nextButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  createButton: {
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
})
