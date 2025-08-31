
import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { createChat } from './services/geminiService';
import { Chat as GeminiChat, Part } from '@google/genai';
import type { ChatMessage } from './types';
import { auth } from './services/firebase';
import firebase from 'firebase/compat/app';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';


// --- LocalStorage DB Helpers (keyed by UID) ---
const saveChatHistory = (uid: string, messages: ChatMessage[]) => {
    try {
        const storableHistory = messages.map(msg =>
            msg.imageUrl?.startsWith('blob:') ? { ...msg, imageUrl: '' } : msg
        );
        localStorage.setItem(`gemini-chat-history-${uid}`, JSON.stringify(storableHistory));
    } catch (e) {
        console.error("Failed to save chat history:", e);
    }
};

const loadChatHistory = (uid: string): ChatMessage[] => {
    try {
        const storedHistory = localStorage.getItem(`gemini-chat-history-${uid}`);
        return storedHistory ? JSON.parse(storedHistory) : [];
    } catch (e) {
        console.error("Failed to load chat history:", e);
        return [];
    }
};

// --- Helper Icons ---
const SendIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;
const LogoutIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>;
const PaperclipIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81" /></svg>;
const XCircleIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>;
const Spinner: React.FC = () => <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>;
const PlusIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const MicrophoneIcon: React.FC<{ isListening?: boolean }> = ({ isListening }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${isListening ? 'text-red-500' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5a6 6 0 00-12 0v1.5a6 6 0 006 6zM12 14.25a3 3 0 003-3v-1.5a3 3 0 00-6 0v1.5a3 3 0 003 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 4.142-3.358 7.5-7.5 7.5s-7.5-3.358-7.5-7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5h.01M18.75 7.5h.01" /></svg>;

// --- Auth Component (Login/Signup with Firebase) ---
const AuthComponent: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !password.trim()) {
            setError("Email and password cannot be empty.");
            return;
        }
        setIsLoading(true);
        try {
            if (isLoginView) {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.createUserWithEmailAndPassword(email, password);
            }
            // onAuthStateChanged in App component will handle the login success
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleView = () => {
        setIsLoginView(!isLoginView);
        setError('');
        setEmail('');
        setPassword('');
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-cyan-400">{isLoginView ? 'Welcome Back' : 'Create Account'}</h1>
                    <p className="text-gray-400 mt-2">{isLoginView ? 'Log in to continue your session' : 'Sign up to start chatting with Gemini AI'}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-sm text-red-400 text-center bg-red-900/50 p-2 rounded-md">{error}</p>}
                    <div>
                        <label htmlFor="email" className="text-sm font-medium text-gray-300 sr-only">Email</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="Email"/>
                    </div>
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-gray-300 sr-only">Password</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="Password"/>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-md transition duration-200 flex items-center justify-center disabled:bg-cyan-800 disabled:cursor-not-allowed" aria-live="polite">
                        {isLoading ? <Spinner /> : (isLoginView ? 'Log In' : 'Sign Up')}
                    </button>
                </form>
                <div className="text-center">
                    <button onClick={toggleView} className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline">
                        {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Helper Functions & Components ---
const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
    });

const MessageRenderer: React.FC<{ content: string }> = ({ content }) => (
    <div className="prose prose-invert prose-lg md:prose-xl max-w-none p-3 font-serif">
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                        <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div">
                            {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code className="bg-gray-800/50 px-1 py-0.5 rounded-sm font-mono text-base" {...props}>
                            {children}
                        </code>
                    );
                },
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
);

// --- Chat Component ---
const ChatComponent: React.FC<{
    user: firebase.User;
    onLogout: () => void;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    onNewChat: () => void;
}> = ({ user, onLogout, messages, setMessages, onNewChat }) => {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);

    const geminiChat = useRef<GeminiChat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const speechRecognition = useRef<any>(null);

    useEffect(() => {
        // Re-initialize chat with history. Image data is not persisted in history,
        // so we only include messages with text to avoid errors.
        const history = messages
            .filter(msg => msg.text) // Ensure message has text
            .map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text! }], // The text part is guaranteed to exist
            }));
        geminiChat.current = createChat(history);
    }, [messages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);
    
    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if(SpeechRecognition) {
            speechRecognition.current = new SpeechRecognition();
            speechRecognition.current.continuous = false;
            speechRecognition.current.interimResults = false;
            speechRecognition.current.onstart = () => setIsListening(true);
            speechRecognition.current.onend = () => setIsListening(false);
            speechRecognition.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => prev ? `${prev} ${transcript}` : transcript);
            };
            speechRecognition.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
            };
        }
    }, []);

    const handleToggleListening = () => {
        if (isListening) {
            speechRecognition.current?.stop();
        } else {
            speechRecognition.current?.start();
        }
    };

    const TypingIndicator = () => (
        <div className="flex justify-start"><div className="max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-lg bg-gray-700"><div className="flex items-center justify-center space-x-1.5"><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div></div></div></div>
    );

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        } else {
            setImage(null);
            setImagePreview(null);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !image) || isLoading) return;

        const currentInput = input;
        const currentImage = image;
        const currentImagePreview = imagePreview;

        const userMessage: ChatMessage = { role: 'user', text: currentInput, imageUrl: currentImagePreview };
        setMessages(prev => [...prev, userMessage]);

        setInput('');
        setImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsLoading(true);

        try {
            if (!geminiChat.current) throw new Error("Chat not initialized");
            
            const messageParts: Part[] = [];

            if (currentImage) {
                const base64Data = await fileToBase64(currentImage);
                messageParts.push({
                    inlineData: {
                        mimeType: currentImage.type,
                        data: base64Data
                    }
                });
            }
            
            if (currentInput.trim()) {
                messageParts.push({ text: currentInput });
            }

            // The `sendMessageStream` method expects an object with a `message`
            // property containing the parts of the message.
            const stream = await geminiChat.current.sendMessageStream({ message: messageParts });

            let modelResponse = '';
            let firstChunk = true;

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    modelResponse += chunkText;
                    if (firstChunk) {
                        setMessages(prev => [...prev, { role: 'model', text: modelResponse }]);
                        firstChunk = false;
                    } else {
                        setMessages(prev => {
                            const newMessages = [...prev];
                            newMessages[newMessages.length - 1].text = modelResponse;
                            return newMessages;
                        });
                    }
                }
            }
            if (firstChunk) {
                 setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I couldn't generate a response." }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, something went wrong. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="flex items-center justify-between p-4 bg-gray-800 shadow-md flex-shrink-0">
                 <div className="flex items-center gap-2">
                    <button onClick={onNewChat} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-700 transition-colors" aria-label="New Chat">
                        <PlusIcon />
                        <span className="hidden sm:inline">New Chat</span>
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300 hidden sm:block" aria-label="User Email">{user.email}</span>
                    <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors" aria-label="Sign out">
                        <LogoutIcon />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-2xl rounded-xl shadow ${msg.role === 'user' ? 'bg-cyan-600' : 'bg-gray-700'}`}>
                           {msg.imageUrl && <img src={msg.imageUrl} alt="User upload" className="rounded-t-xl max-h-60 w-full object-cover" />}
                           {msg.text && <MessageRenderer content={msg.text} />}
                        </div>
                    </div>
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </main>

            <footer className="p-4 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700/50 flex-shrink-0">
                {imagePreview && (
                    <div className="relative inline-block mb-2">
                        <img src={imagePreview} alt="Selected preview" className="h-20 w-20 object-cover rounded-md"/>
                        <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full hover:bg-gray-600 transition-colors" aria-label="Remove image">
                           <XCircleIcon />
                        </button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                     <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors flex-shrink-0 disabled:opacity-50" aria-label="Attach file">
                        <PaperclipIcon />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
<textarea
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); }}}
    placeholder="Type your message or add an image..."
    rows={1}
    className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 text-lg font-serif"
    style={{maxHeight: '100px'}}
    aria-label="Chat input"
    disabled={isLoading}
/>                    {speechRecognition.current && (
                         <button type="button" onClick={handleToggleListening} disabled={isLoading} className={`p-2 rounded-full hover:bg-gray-700 transition-colors flex-shrink-0 disabled:opacity-50 ${isListening ? 'bg-red-500/20' : ''}`} aria-label={isListening ? 'Stop listening' : 'Start listening'}>
                            <MicrophoneIcon isListening={isListening} />
                        </button>
                    )}
                    <button type="submit" disabled={isLoading || (!input.trim() && !image)} className="p-2 bg-cyan-600 rounded-full text-white disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-cyan-700 transition-colors flex-shrink-0" aria-label="Send message">
                        <SendIcon />
                    </button>
                </form>
            </footer>
        </div>
    );
};

// --- App Component (Root) ---
const App: React.FC = () => {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const initialWelcomeMessage: ChatMessage = { role: 'model', text: `Hello there! I'm your Gemini-powered assistant. You can ask me questions, upload an image, or even use your voice. How can I help you today?` };

    // Handle Auth State Changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setAuthLoading(false);
            if (firebaseUser) {
                const history = loadChatHistory(firebaseUser.uid);
                setMessages(history.length > 0 ? history : [initialWelcomeMessage]);
            } else {
                setMessages([]);
            }
        });
        return () => unsubscribe();
    }, []);

    // Persist messages to localStorage on change
    useEffect(() => {
        if (user) {
            saveChatHistory(user.uid, messages);
        }
    }, [messages, user]);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            // onAuthStateChanged will handle state cleanup
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };
    
    const handleNewChat = () => {
        setMessages([initialWelcomeMessage]);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Spinner />
            </div>
        );
    }

    if (!user) {
        return <AuthComponent />;
    }

    return (
        <ChatComponent
            user={user}
            onLogout={handleLogout}
            messages={messages}
            setMessages={setMessages}
            onNewChat={handleNewChat}
        />
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
