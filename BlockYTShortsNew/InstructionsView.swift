// InstructionsView.swift
// BlockYTShortsNew
//
// Created by vhalan on 10/05/2025.
//

import SwiftUI
import WebKit // Required for WKWebView

// Helper struct to display local HTML content
struct HTMLView: UIViewRepresentable {
    let htmlFileName: String

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        // Set a transparent background for the webview if needed
        // webView.isOpaque = false
        // webView.backgroundColor = UIColor.clear
        // webView.scrollView.backgroundColor = UIColor.clear
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if let url = Bundle.main.url(forResource: htmlFileName, withExtension: "html") {
            uiView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            // Handle the case where the HTML file is not found
            uiView.loadHTMLString("<html><body><p>Error: HTML file '\(htmlFileName).html' not found.</p></body></html>", baseURL: nil)
        }
    }
}

struct InstructionsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("How to Enable BlockYTShorts")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.bottom, 10)

                InstructionStep(
                    stepNumber: 1,
                    iconName: "gear",
                    text: "Open the **Settings** app on your iPhone or iPad."
                )

                InstructionStep(
                    stepNumber: 2,
                    iconName: "safari.fill", // Using filled icon for better visibility
                    text: "Scroll down and tap on **Safari**."
                )

                InstructionStep(
                    stepNumber: 3,
                    iconName: "puzzlepiece.extension.fill",
                    text: "Under the 'GENERAL' section, tap on **Extensions**."
                )

                InstructionStep(
                    stepNumber: 4,
                    iconName: "list.bullet",
                    text: "Find **BlockYTShorts** in the list and tap on it."
                )
                
                VStack(alignment: .leading, spacing: 10) {
                    InstructionStep(
                        stepNumber: 5,
                        iconName: "switch.2", // Represents a toggle
                        text: "Turn the main toggle **ON** to enable the extension for Safari."
                    )
                    // HTML Diagram for the toggle
                    HTMLView(htmlFileName: "diagram_toggle_on")
                        .frame(height: 80) // Adjust height as needed for your diagram
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.gray.opacity(0.5), lineWidth: 1)
                        )
                        .padding(.leading, 40) // Indent to align with text
                }

                InstructionStep(
                    stepNumber: 6,
                    iconName: "hand.raised.fill",
                    text: "Grant Permissions: Below the main toggle, under 'PERMISSIONS FOR \"BlockYTShorts\"', ensure permissions are granted for the websites you want the extension to modify. \n\n- For **YouTube Shorts**: Tap on **youtube.com** (if listed, or 'Other Websites') and select **Allow**.\n- For **Instagram Reels**: Tap on **instagram.com** (if listed, or 'Other Websites') and select **Allow**.\n\nFor full functionality, you might need to set permissions to 'Allow' for 'All Websites' if specific sites are not listed or if the extension requires broader access."
                )
                
                Text("How to Use the Extension")
                    .font(.title)
                    .fontWeight(.bold)
                    .padding(.top, 30)
                    .padding(.bottom, 10)

                // YouTube Section
                VStack(alignment: .leading, spacing: 15) {
                    Text("On YouTube:")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .padding(.bottom, 5)

                    InstructionStep(
                        stepNumber: 1,
                        iconName: "play.tv.fill",
                        text: "Once enabled and permissions are granted for **youtube.com**, the extension will automatically redirect YouTube Shorts to the regular video player."
                    )

                    InstructionStep(
                        stepNumber: 2,
                        iconName: "ellipsis.circle.fill", // Safari extensions menu icon
                        text: "To access YouTube-specific settings (if available), tap the **'AA'** icon or the **puzzle piece icon** (depending on your iOS version) in Safari's address bar. Then, select **BlockYTShorts** from the menu."
                    )
                }
                .padding(.bottom, 20) // Space before Instagram section

                // Instagram Section
                VStack(alignment: .leading, spacing: 15) {
                    Text("On Instagram:")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .padding(.bottom, 5)

                    InstructionStep(
                        stepNumber: 1,
                        iconName: "camera.fill", // Instagram-related icon
                        text: "After enabling and granting permissions for **instagram.com**, **BlockYTShorts** can help manage your Instagram experience, particularly with Reels."
                    )

                    InstructionStep(
                        stepNumber: 2,
                        iconName: "ellipsis.circle.fill", // Consistent icon for accessing settings
                        text: "Access Instagram Settings: Tap the **'AA'** icon or **puzzle piece icon** in Safari's address bar. Select **BlockYTShorts** from the menu. Here you can configure Instagram-specific options."
                    )

                    InstructionStep(
                        stepNumber: 3,
                        iconName: "arrow.uturn.left.circle.fill", // Icon for redirection
                        text: "Redirect Reels: In the extension's settings (accessed as described above), you can enable **'Redirect Instagram Reels'**. When active, opening a Reel link will redirect you to your main Instagram feed instead of the Reels viewer."
                    )

                    InstructionStep(
                        stepNumber: 4,
                        iconName: "eye.slash.fill", // Icon for hiding UI
                        text: "Remove Reels UI: Enable **'Remove Instagram Reels UI'** in the extension's settings to hide Reels navigation buttons, tabs, and Reels previews from your Instagram feed and other pages."
                    )
                }
                
                Spacer()
            }
            .padding()
        }
        .navigationTitle("Instructions")
        // .navigationBarTitleDisplayMode(.inline) // Optional: if you want a smaller title
    }
}

struct InstructionStep: View {
    let stepNumber: Int
    let iconName: String
    let text: LocalizedStringKey // Allows for Markdown bolding

    var body: some View {
        HStack(alignment: .top, spacing: 15) {
            Image(systemName: iconName)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 30) // For alignment
            VStack(alignment: .leading) {
                Text("Step \(stepNumber)")
                    .font(.headline)
                    .fontWeight(.semibold)
                Text(text)
                    .font(.subheadline)
            }
        }
    }
}

#Preview {
    NavigationView { // Wrap in NavigationView for previewing title
        InstructionsView()
    }
}
