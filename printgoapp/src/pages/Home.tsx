import React from "react";
import { Link } from "react-router-dom";

export const Home = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="px-4 py-12 text-center" style={{backgroundColor: '#FFFDF6'}}>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-800">
          PrintGo Kiosk
        </h1>
        <p className="text-xl md:text-2xl mb-8 text-gray-600 max-w-4xl mx-auto">
          Automated printing kiosk platform - like a vending machine for photocopies and prints.
          Scan, upload, pay, and print - fully automated, no operators needed.
        </p>
        <Link
          to="/auth"
          className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
          style={{backgroundColor: '#A0C878'}}
        >
          Get Started
        </Link>
      </section>

      {/* How It Works */}
      <section className="px-4 py-12" style={{backgroundColor: '#FAF6E9'}}>
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">How It Works</h2>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{backgroundColor: '#DDEB9D'}}>
              1
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Scan QR Code</h3>
            <p className="text-gray-600">Scan the unique QR code displayed on the kiosk screen</p>
          </div>
          <div className="text-center p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{backgroundColor: '#DDEB9D'}}>
              2
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Upload & Configure</h3>
            <p className="text-gray-600">Upload documents, select print options, and complete payment</p>
          </div>
          <div className="text-center p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{backgroundColor: '#DDEB9D'}}>
              3
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Cloud Processing</h3>
            <p className="text-gray-600">Server processes files and queues print job for your kiosk</p>
          </div>
          <div className="text-center p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{backgroundColor: '#DDEB9D'}}>
              4
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Print & Collect</h3>
            <p className="text-gray-600">Kiosk prints and dispenses your documents automatically</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-12" style={{backgroundColor: '#FFFDF6'}}>
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Benefits</h2>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-lg border-l-4" style={{borderLeftColor: '#A0C878', backgroundColor: '#FAF6E9'}}>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Fully Automated</h3>
            <p className="text-gray-600">No human operators needed - complete self-service solution</p>
          </div>
          <div className="p-6 rounded-lg border-l-4" style={{borderLeftColor: '#A0C878', backgroundColor: '#FAF6E9'}}>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Secure & Scalable</h3>
            <p className="text-gray-600">Cloud-managed payments and file handling, deploy multiple kiosks</p>
          </div>
          <div className="p-6 rounded-lg border-l-4" style={{borderLeftColor: '#A0C878', backgroundColor: '#FAF6E9'}}>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">Familiar Experience</h3>
            <p className="text-gray-600">Like an ATM or vending machine, but for document printing</p>
          </div>
          <div className="p-6 rounded-lg border-l-4" style={{borderLeftColor: '#A0C878', backgroundColor: '#FAF6E9'}}>
            <h3 className="text-xl font-semibold mb-2 text-gray-800">IoT Integration</h3>
            <p className="text-gray-600">Combines Raspberry Pi, web development, and payment gateways</p>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="px-4 py-12" style={{backgroundColor: '#FAF6E9'}}>
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Architecture</h2>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Cloud Server</h3>
              <p className="text-gray-600 mb-4">Handles file uploads, payments, job queue, and PDF processing</p>
              <div className="text-sm text-gray-500">Node.js + MongoDB</div>
            </div>
            <div className="p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Kiosk (Raspberry Pi)</h3>
              <p className="text-gray-600 mb-4">Lightweight client for job fetching and printing via CUPS</p>
              <div className="text-sm text-gray-500">Python + Linux</div>
            </div>
            <div className="p-6 rounded-lg" style={{backgroundColor: '#FFFDF6'}}>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Printer</h3>
              <p className="text-gray-600 mb-4">Standard USB/Wi-Fi printer controlled by Raspberry Pi</p>
              <div className="text-sm text-gray-500">CUPS Compatible</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="px-4 py-12 text-center" style={{backgroundColor: '#A0C878'}}>
        <h2 className="text-3xl font-bold mb-4 text-white">Ready to Deploy Smart Printing?</h2>
        <p className="text-xl mb-8 text-green-100 max-w-2xl mx-auto">
          Join the future of automated document printing. Deploy kiosks anywhere and manage them from the cloud.
        </p>
        <button
          className="bg-white text-green-800 font-bold py-3 px-8 rounded-lg text-lg hover:bg-gray-100 transition-colors"
        >
          Contact Us
        </button>
      </section>
    </div>
  );
};
