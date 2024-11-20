import React from "react";

export const IntroRoomSection = () => {
    return (
        <div className="w-full mt-6 space-y-8 px-4 md:px-8 lg:px-16">
            <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
                {/* Room Title */}
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Luxury Suite
                </h2>

                {/* Room Description */}
                <p className="text-gray-600 leading-relaxed mb-6">
                    Experience the ultimate in comfort and style in our Luxury Suite.
                    With stunning views, modern amenities, and exquisite décor, this
                    room is designed for relaxation and indulgence.
                </p>

                {/* Room Features */}
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-700 mb-3">
                        Features
                    </h3>
                    <ul className="list-disc list-inside text-gray-600 space-y-2">
                        <li>King-size bed with premium bedding</li>
                        <li>Private balcony with ocean views</li>
                        <li>En-suite bathroom with rainfall shower</li>
                        <li>High-speed Wi-Fi and flat-screen TV</li>
                        <li>Complimentary breakfast</li>
                    </ul>
                </div>

                {/* Room Notice */}
                <div className="bg-gray-100 border-l-4 border-yellow-500 p-4">
                    <p className="text-gray-700">
                        <strong>Notice:</strong> Smoking is strictly prohibited
                        inside the room. Pets are not allowed.
                    </p>
                </div>
            </div>
        </div>
    );
};
